// Package monitoring provides database health/performance monitoring services.
package monitoring

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
	connsvc "github.com/edsuwarna/jagad/internal/connection"
)

// ConnLister abstracts the connection listing needed by the collector.
// Both connection.Repository and connection.Service satisfy this.
type ConnLister interface {
	List() ([]connsvc.Connection, error)
	GetByID(id string) (*connsvc.Connection, error)
}

// Collector periodically collects monitoring metrics from managed source databases.
type Collector struct {
	conns    ConnLister
	store    Store
	interval time.Duration
	mu       sync.Mutex
	stopCh   chan struct{}
	running  bool
}

// NewCollector creates a new monitoring collector.
// conns provides access to managed database connections.
// store is where collected metrics are saved.
// interval defaults to 60s if zero.
func NewCollector(conns ConnLister, store Store, interval time.Duration) *Collector {
	if interval <= 0 {
		interval = 60 * time.Second
	}
	return &Collector{
		conns:    conns,
		store:    store,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins periodic collection in a background goroutine.
func (c *Collector) Start(ctx context.Context) {
	c.mu.Lock()
	if c.running {
		c.mu.Unlock()
		return
	}
	c.running = true
	c.mu.Unlock()

	go c.loop(ctx)
	slog.Info("monitoring collector started", "interval", c.interval)
}

// Stop signals the collector to stop after the current cycle.
func (c *Collector) Stop() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.running {
		return
	}
	close(c.stopCh)
	c.running = false
	slog.Info("monitoring collector stopped")
}

// CollectNow triggers an immediate collection cycle (blocking).
func (c *Collector) CollectNow(ctx context.Context) error {
	return c.collect(ctx)
}

// Running returns whether the collector is currently active.
func (c *Collector) Running() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.running
}

func (c *Collector) loop(ctx context.Context) {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	// Run once immediately on start
	if err := c.collect(ctx); err != nil {
		slog.Warn("monitoring collector initial cycle", "error", err)
	}

	for {
		select {
		case <-ticker.C:
			if err := c.collect(ctx); err != nil {
				slog.Warn("monitoring collector cycle", "error", err)
			}
		case <-c.stopCh:
			return
		case <-ctx.Done():
			return
		}
	}
}

type collectResult struct {
	ConnectionID string
	Health       *HealthCheck
	Metrics      []DBMetric
	Performance  []PerformanceMetric
	Error        error
}

func (c *Collector) collect(ctx context.Context) error {
	start := time.Now()
	slog.Debug("monitoring collection cycle starting")

	// Get all managed connections
	conns, err := c.conns.List()
	if err != nil {
		return fmt.Errorf("list connections: %w", err)
	}

	if len(conns) == 0 {
		slog.Debug("no connections to monitor")
		return nil
	}

	// Collect from each connection in sequence (parallel would be better but
	// we keep it simple — source DBs are expected to be reachable)
	var succeeded, failed int
	for _, conn := range conns {
		// Get full connection details with password
		fullConn, err := c.conns.GetByID(conn.ID)
		if err != nil {
			slog.Warn("monitoring: get connection details", "id", conn.ID, "error", err)
			failed++
			continue
		}
		if fullConn == nil {
			slog.Warn("monitoring: connection not found", "id", conn.ID)
			failed++
			continue
		}

		if err := c.collectConnection(ctx, fullConn); err != nil {
			slog.Warn("monitoring: collect failed", "id", conn.ID, "name", conn.Name, "error", err)
			failed++
		} else {
			succeeded++
		}
	}

	elapsed := time.Since(start)
	slog.Info("monitoring collection complete",
		"duration", elapsed.Round(time.Millisecond),
		"succeeded", succeeded,
		"failed", failed,
	)
	return nil
}

func (c *Collector) collectConnection(ctx context.Context, conn *connsvc.Connection) error {
	now := time.Now()

	// 1. Health check
	health := c.collectHealth(ctx, conn, now)

	// Save health check
	if err := c.store.RecordHealthCheck(*health); err != nil {
		return fmt.Errorf("save health check: %w", err)
	}

	// If DB is down, skip further metrics
	if health.Status == "down" {
		return nil
	}

	// 2. DB Metrics (size, cache hit, connections)
	metrics, err := c.collectDBMetrics(ctx, conn, now)
	if err != nil {
		slog.Warn("monitoring: collect db metrics", "id", conn.ID, "error", err)
	} else {
		for _, m := range metrics {
			if err := c.store.RecordDBMetric(m); err != nil {
				slog.Warn("monitoring: save db metric", "id", conn.ID, "error", err)
			}
		}
	}

	// 3. Performance metrics (slow queries)
	perf, err := c.collectPerformance(ctx, conn, now)
	if err != nil {
		slog.Debug("monitoring: collect performance (non-critical)", "id", conn.ID, "error", err)
	} else {
		for _, p := range perf {
			if err := c.store.RecordPerformanceMetric(p); err != nil {
				slog.Warn("monitoring: save performance metric", "id", conn.ID, "error", err)
			}
		}
	}

	// 4. P2 — Autovacuum / Optimizer
	c.collectAutovacuumAsync(ctx, conn, now)

	// 5. P2 — Lock Detection
	c.collectLocksAsync(ctx, conn, now)

	// 6. P2 — Replication Lag
	c.collectReplicationLagAsync(ctx, conn, now)

	// 7. P2 — Table-Level Metrics
	c.collectTableMetricsAsync(ctx, conn, now)

	return nil
}

// ── Health Check ──

func (c *Collector) collectHealth(ctx context.Context, conn *connsvc.Connection, now time.Time) *HealthCheck {
	h := HealthCheck{
		Time:         now,
		ConnectionID: conn.ID,
	}

	sourceDB, err := openSourceDB(conn)
	if err != nil {
		h.Status = "down"
		h.ErrorMessage = err.Error()
		return &h
	}
	defer sourceDB.Close()

	// Measure response time
	pingStart := time.Now()
	err = sourceDB.PingContext(ctx)
	pingElapsed := time.Since(pingStart)
	h.ResponseTimeMs = int(pingElapsed.Milliseconds())

	if err != nil {
		h.Status = "down"
		h.ErrorMessage = err.Error()
		return &h
	}

	// Get active connections count
	activeConns := c.queryActiveConnections(ctx, sourceDB, conn.DBType)
	h.ActiveConnections = activeConns

	// Determine status based on response time
	if h.ResponseTimeMs < 1000 {
		h.Status = "healthy"
	} else if h.ResponseTimeMs < 5000 {
		h.Status = "degraded"
	} else {
		h.Status = "down"
		h.ErrorMessage = fmt.Sprintf("response time too high: %dms", h.ResponseTimeMs)
	}

	return &h
}

func (c *Collector) queryActiveConnections(ctx context.Context, db *sql.DB, dbType string) int {
	switch dbType {
	case "postgresql":
		var count int
		err := db.QueryRowContext(ctx, `SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`).Scan(&count)
		if err != nil {
			return 0
		}
		return count
	case "mysql", "mariadb":
		var count int
		schemaForThreads := "performance_schema"
		if dbType == "mariadb" {
			schemaForThreads = "information_schema"
		}
		err := db.QueryRowContext(ctx, fmt.Sprintf(
			`SELECT VARIABLE_VALUE FROM %s.global_status WHERE UPPER(VARIABLE_NAME) LIKE UPPER('%%THREADS_CONNECTED%%')`,
			schemaForThreads,
		)).Scan(&count)
		if err != nil {
			// Fallback
			_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.processlist`).Scan(&count)
		}
		return count
	default:
		return 0
	}
}

// ── DB Metrics ──

func (c *Collector) collectDBMetrics(ctx context.Context, conn *connsvc.Connection, now time.Time) ([]DBMetric, error) {
	sourceDB, err := openSourceDB(conn)
	if err != nil {
		return nil, err
	}
	defer sourceDB.Close()

	switch conn.DBType {
	case "postgresql":
		return c.collectPGMetrics(ctx, sourceDB, conn, now)
	case "mysql", "mariadb":
		return c.collectMySQLMetrics(ctx, sourceDB, conn, now)
	default:
		return nil, fmt.Errorf("unsupported db type: %s", conn.DBType)
	}
}

func (c *Collector) collectPGMetrics(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) ([]DBMetric, error) {
	// Get all non-template databases
	rows, err := db.QueryContext(ctx, `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`)
	if err != nil {
		return nil, fmt.Errorf("list databases: %w", err)
	}
	defer rows.Close()

	var metrics []DBMetric
	for rows.Next() {
		var dbName string
		if err := rows.Scan(&dbName); err != nil {
			continue
		}

		m := DBMetric{
			Time:         now,
			ConnectionID: conn.ID,
			DBName:       dbName,
			DBType:       conn.DBType,
		}

		// Database size
		_ = db.QueryRowContext(ctx, fmt.Sprintf(`SELECT pg_database_size('%s')`, escapePGString(dbName))).Scan(&m.DBSizeBytes)

		// Cache hit ratio and QPS from pg_stat_database
		_ = db.QueryRowContext(ctx, `
			SELECT 
				CASE WHEN COALESCE(blks_hit, 0) + COALESCE(blks_read, 0) > 0 
					THEN ROUND(blks_hit::numeric / (blks_hit + blks_read) * 100, 2) 
					ELSE 0 
				END as cache_hit,
				COALESCE(xact_commit, 0) + COALESCE(xact_rollback, 0) as total_xacts,
				COALESCE(numbackends, 0) as backends
			FROM pg_stat_database WHERE datname = $1`, dbName,
		).Scan(&m.CacheHitRatio, &m.QPS, &m.ConnectionsTotal)

		// Max connections and usage percentage
		_ = db.QueryRowContext(ctx, `SELECT setting::int FROM pg_settings WHERE name = 'max_connections'`).Scan(&m.MaxConnections)
		if m.MaxConnections > 0 {
			m.ConnUsagePercent = float64(m.ConnectionsTotal) / float64(m.MaxConnections) * 100
		}

		metrics = append(metrics, m)
	}

	return metrics, nil
}

func (c *Collector) collectMySQLMetrics(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) ([]DBMetric, error) {
	// Get all databases
	rows, err := db.QueryContext(ctx, `SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys') ORDER BY SCHEMA_NAME`)
	if err != nil {
		return nil, fmt.Errorf("list databases: %w", err)
	}
	defer rows.Close()

	var metrics []DBMetric
	for rows.Next() {
		var dbName string
		if err := rows.Scan(&dbName); err != nil {
			continue
		}

		m := DBMetric{
			Time:         now,
			ConnectionID: conn.ID,
			DBName:       dbName,
			DBType:       conn.DBType,
		}

		// Database size
		_ = db.QueryRowContext(ctx, `
			SELECT COALESCE(SUM(data_length + index_length), 0) 
			FROM information_schema.tables 
			WHERE table_schema = ?`, dbName,
		).Scan(&m.DBSizeBytes)

		// Connections total
		schemaForThreads := "performance_schema"
		if conn.DBType == "mariadb" {
			schemaForThreads = "information_schema"
		}
		_ = db.QueryRowContext(ctx, fmt.Sprintf(
			`SELECT VARIABLE_VALUE FROM %s.global_status WHERE UPPER(VARIABLE_NAME) LIKE UPPER('%%THREADS_CONNECTED%%')`,
			schemaForThreads,
		)).Scan(&m.ConnectionsTotal)

		// Max connections and usage percentage
		_ = db.QueryRowContext(ctx, `SELECT @@max_connections`).Scan(&m.MaxConnections)
		if m.MaxConnections > 0 {
			m.ConnUsagePercent = float64(m.ConnectionsTotal) / float64(m.MaxConnections) * 100
		}

		// Cache hit ratio (InnoDB buffer pool)
		var hitRate sql.NullFloat64
		var schemaForStatus string
		if conn.DBType == "mariadb" {
			schemaForStatus = "information_schema"
		} else {
			schemaForStatus = "performance_schema"
		}
		q := fmt.Sprintf(`
			SELECT
				ROUND((1.0 - (
					(SELECT VARIABLE_VALUE FROM %s.global_status WHERE UPPER(VARIABLE_NAME) LIKE UPPER('%%INNODB_BUFFER_POOL_READS%%')) + 0.0
				) / (
					(SELECT VARIABLE_VALUE FROM %s.global_status WHERE UPPER(VARIABLE_NAME) LIKE UPPER('%%INNODB_BUFFER_POOL_READ_REQUESTS%%')) + 1.0
				)) * 100, 2
			) AS hit_ratio`, schemaForStatus, schemaForStatus)
		err = db.QueryRowContext(ctx, q).Scan(&hitRate)
		if err == nil && hitRate.Valid {
			m.CacheHitRatio = hitRate.Float64
		}

		metrics = append(metrics, m)
	}

	return metrics, nil
}

// ── Performance Metrics (Slow Queries) ──

func (c *Collector) collectPerformance(ctx context.Context, conn *connsvc.Connection, now time.Time) ([]PerformanceMetric, error) {
	sourceDB, err := openSourceDB(conn)
	if err != nil {
		return nil, err
	}
	defer sourceDB.Close()

	switch conn.DBType {
	case "postgresql":
		return c.collectPGPerformance(ctx, sourceDB, conn, now)
	case "mysql":
		return c.collectMySQLPerformance(ctx, sourceDB, conn, now)
	default:
		// MySQL/MariaDB performance_schema might not be available
		return nil, nil
	}
}

func (c *Collector) collectPGPerformance(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) ([]PerformanceMetric, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT 
			md5(query::text) as query_id,
			LEFT(query, 500) as query_text,
			mean_exec_time as mean_time_ms,
			total_exec_time as total_time_ms,
			calls,
			rows as rows_avg
		FROM pg_stat_statements 
		WHERE query NOT LIKE '%pg_stat%'
		ORDER BY mean_exec_time DESC 
		LIMIT 10`)
	if err != nil {
		// pg_stat_statements might not be enabled — try pg_stat_statement (older PG)
		rows, err = db.QueryContext(ctx, `
			SELECT 
				md5(query::text) as query_id,
				LEFT(query, 500) as query_text,
				mean_time as mean_time_ms,
				total_time as total_time_ms,
				calls,
				rows as rows_avg
			FROM pg_stat_statements 
			WHERE query NOT LIKE '%pg_stat%'
			ORDER BY mean_time DESC 
			LIMIT 10`)
		if err != nil {
			return nil, fmt.Errorf("pg_stat_statements not available: %w", err)
		}
	}
	defer rows.Close()

	var perf []PerformanceMetric
	for rows.Next() {
		var p PerformanceMetric
		if err := rows.Scan(&p.QueryID, &p.QueryText, &p.MeanTimeMs, &p.TotalTimeMs, &p.Calls, &p.RowsAvg); err != nil {
			continue
		}
		p.Time = now
		p.ConnectionID = conn.ID
		p.DBType = conn.DBType
		perf = append(perf, p)
	}

	return perf, nil
}

func (c *Collector) collectMySQLPerformance(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) ([]PerformanceMetric, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT 
			MD5(CONCAT(SCHEMA_NAME, DIGEST)) as query_id,
			LEFT(DIGEST_TEXT, 500) as query_text,
			ROUND(SUM_TIMER_WAIT / 1000000000 / COUNT_STAR, 2) as mean_time_ms,
			ROUND(SUM_TIMER_WAIT / 1000000000, 2) as total_time_ms,
			COUNT_STAR as calls,
			ROUND(SUM_ROWS_AFFECTED / COUNT_STAR, 2) as rows_avg
		FROM performance_schema.events_statements_summary_by_digest
		WHERE DIGEST_TEXT IS NOT NULL
		ORDER BY mean_time_ms DESC
		LIMIT 10`)
	if err != nil {
		return nil, fmt.Errorf("performance_schema not available: %w", err)
	}
	defer rows.Close()

	var perf []PerformanceMetric
	for rows.Next() {
		var p PerformanceMetric
		if err := rows.Scan(&p.QueryID, &p.QueryText, &p.MeanTimeMs, &p.TotalTimeMs, &p.Calls, &p.RowsAvg); err != nil {
			continue
		}
		p.Time = now
		p.ConnectionID = conn.ID
		p.DBType = conn.DBType
		perf = append(perf, p)
	}

	return perf, nil
}

// ── P2: Autovacuum / Optimizer ──

func (c *Collector) collectAutovacuumAsync(ctx context.Context, conn *connsvc.Connection, now time.Time) {
	sourceDB, err := openSourceDB(conn)
	if err != nil {
		return
	}
	defer sourceDB.Close()

	switch conn.DBType {
	case "postgresql":
		c.collectPGAutovacuum(ctx, sourceDB, conn, now)
	case "mysql", "mariadb":
		c.collectMySQLOptimizer(ctx, sourceDB, conn, now)
	}
}

func (c *Collector) collectPGAutovacuum(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			schemaname,
			relname,
			n_live_tup,
			n_dead_tup,
			CASE WHEN (n_live_tup + n_dead_tup) > 0
				THEN ROUND(n_dead_tup::numeric / (n_live_tup + n_dead_tup) * 100, 2)
				ELSE 0
			END as dead_tuple_pct,
			last_autovacuum,
			last_autoanalyze,
			0 as mod_since_vacuum,
			autovacuum_count,
			autoanalyze_count,
			COALESCE(pg_total_relation_size(relid), 0) as total_size,
			COALESCE(pg_indexes_size(relid), 0) as index_size
		FROM pg_stat_user_tables
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		ORDER BY n_dead_tup DESC NULLS LAST
		LIMIT 20`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var a AutovacuumInfo
		var lastVac, lastAna sql.NullTime
		var deadPct sql.NullFloat64
		var totalSize, idxSize sql.NullInt64
		if err := rows.Scan(&a.SchemaName, &a.TableName, &a.LiveTuples, &a.DeadTuples,
			&deadPct, &lastVac, &lastAna, &a.ModSinceLastVacuum,
			&a.NAutoVacuum, &a.NAutoAnalyze, &totalSize, &idxSize); err != nil {
			continue
		}
		a.Time = now
		a.ConnectionID = conn.ID
		a.DBType = conn.DBType
		if deadPct.Valid {
			a.DeadTupleRatio = deadPct.Float64
		}
		if lastVac.Valid {
			a.LastAutovacuum = &lastVac.Time
		}
		if lastAna.Valid {
			a.LastAutoanalyze = &lastAna.Time
		}
		if totalSize.Valid {
			a.TableSize = totalSize.Int64
		}
		if idxSize.Valid {
			a.IndexSize = idxSize.Int64
		}
		// Estimate vacuum threshold
		_ = db.QueryRowContext(ctx,
			`SELECT (current_setting('autovacuum_vacuum_threshold')::int + (current_setting('autovacuum_vacuum_scale_factor')::numeric * $1)::int)::bigint`,
			a.LiveTuples).Scan(&a.VacuumThreshold)
		a.Engine = "PostgreSQL"

		_ = c.store.RecordAutovacuumInfo(a)
	}
}

func (c *Collector) collectMySQLOptimizer(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			TABLE_SCHEMA,
			TABLE_NAME,
			ENGINE,
			TABLE_ROWS,
			DATA_LENGTH,
			INDEX_LENGTH,
			DATA_FREE,
			TABLE_COLLATION
		FROM information_schema.tables
		WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
		ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
		LIMIT 20`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var a AutovacuumInfo
		var engine, collation sql.NullString
		var tableRows, dataLen, idxLen, dataFree sql.NullInt64
		if err := rows.Scan(&a.SchemaName, &a.TableName, &engine, &tableRows,
			&dataLen, &idxLen, &dataFree, &collation); err != nil {
			continue
		}
		a.Time = now
		a.ConnectionID = conn.ID
		a.DBType = conn.DBType
		if engine.Valid {
			a.Engine = engine.String
		}
		if collation.Valid {
			a.TableCollation = collation.String
		}
		if tableRows.Valid {
			a.TableRows = tableRows.Int64
		}
		if dataLen.Valid {
			a.TableSize = dataLen.Int64
		}
		if idxLen.Valid {
			a.IndexSize = idxLen.Int64
		}
		if dataFree.Valid {
			a.DataFree = dataFree.Int64
		}
		a.LiveTuples = tableRows.Int64
		_ = c.store.RecordAutovacuumInfo(a)
	}
}

// ── P2: Lock Detection ──

func (c *Collector) collectLocksAsync(ctx context.Context, conn *connsvc.Connection, now time.Time) {
	sourceDB, err := openSourceDB(conn)
	if err != nil {
		return
	}
	defer sourceDB.Close()

	switch conn.DBType {
	case "postgresql":
		c.collectPGLocks(ctx, sourceDB, conn, now)
	case "mysql", "mariadb":
		c.collectMySQLLocks(ctx, sourceDB, conn, now)
	}
}

func (c *Collector) collectPGLocks(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			COALESCE(bl.datname, '') as database_name,
			COALESCE(bl.relation::regclass::text, '') as relation_name,
			COALESCE(bl.locktype, '') as lock_type,
			COALESCE(bl.mode, '') as lock_mode,
			bl.granted,
			bl.pid as blocked_pid,
			COALESCE(ba.usename, '') as blocked_user,
			COALESCE(LEFT(ba.query, 200), '') as blocked_query,
			COALESCE(EXTRACT(EPOCH FROM (NOW() - ba.query_start)), 0) as blocked_duration_seconds,
			COALESCE(wl.pid, 0) as blocking_pid,
			COALESCE(wa.usename, '') as blocking_user,
			COALESCE(LEFT(wa.query, 200), '') as blocking_query
		FROM pg_locks bl
		LEFT JOIN pg_stat_activity ba ON bl.pid = ba.pid
		LEFT JOIN pg_locks wl ON bl.locktype = wl.locktype
			AND bl.database = wl.database
			AND bl.relation = wl.relation
			AND bl.pid != wl.pid
			AND wl.granted = true
		LEFT JOIN pg_stat_activity wa ON wl.pid = wa.pid
		WHERE NOT bl.granted
			AND bl.locktype IN ('relation', 'tuple', 'transactionid', 'extend')
		LIMIT 20`)
	if err != nil {
		// pg_locks might not be accessible — skip silently
		return
	}
	defer rows.Close()

	for rows.Next() {
		var l LockInfo
		if err := rows.Scan(&l.DatabaseName, &l.RelationName, &l.LockType, &l.LockMode,
			&l.Granted, &l.BlockedPID, &l.BlockedUser, &l.BlockedQuery,
			&l.BlockedDuration, &l.BlockingPID, &l.BlockingUser, &l.BlockingQuery); err != nil {
			continue
		}
		l.Time = now
		l.ConnectionID = conn.ID
		l.DBType = conn.DBType
		_ = c.store.RecordLockInfo(l)
	}
}

func (c *Collector) collectMySQLLocks(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			COALESCE(trx.TRX_ID, 0) as blocked_pid,
			COALESCE(prc.USER, '') as blocked_user,
			COALESCE(LEFT(prc.INFO, 200), '') as blocked_query,
			COALESCE(TIMESTAMPDIFF(SECOND, trx.TRX_STARTED, NOW()), 0) as blocked_duration,
			COALESCE(trx.TRX_REQUESTED_LOCK_ID, '') as lock_type,
			'waiting' as lock_mode,
			false as granted
		FROM information_schema.INNODB_TRX trx
		JOIN information_schema.PROCESSLIST prc ON trx.TRX_MYSQL_THREAD_ID = prc.ID
		WHERE trx.TRX_REQUESTED_LOCK_ID IS NOT NULL
		LIMIT 20`)
	if err != nil {
		// Try SHOW PROCESSLIST as fallback for lock detection
		rows2, err2 := db.QueryContext(ctx, `SELECT ID, USER, INFO, TIME FROM information_schema.processlist WHERE INFO IS NOT NULL ORDER BY TIME DESC LIMIT 20`)
		if err2 != nil {
			return
		}
		defer rows2.Close()
		for rows2.Next() {
			var l LockInfo
			if err2 := rows2.Scan(&l.BlockedPID, &l.BlockedUser, &l.BlockedQuery, &l.BlockedDuration); err2 != nil {
				continue
			}
			l.Time = now
			l.ConnectionID = conn.ID
			l.DBType = conn.DBType
			l.LockMode = "long_running"
			l.LockType = "query"
			if l.BlockedDuration > 60 {
				_ = c.store.RecordLockInfo(l)
			}
		}
		return
	}
	defer rows.Close()

	for rows.Next() {
		var l LockInfo
		if err := rows.Scan(&l.BlockedPID, &l.BlockedUser, &l.BlockedQuery, &l.BlockedDuration,
			&l.LockType, &l.LockMode, &l.Granted); err != nil {
			continue
		}
		l.Time = now
		l.ConnectionID = conn.ID
		l.DBType = conn.DBType
		l.DatabaseName = conn.Name
		_ = c.store.RecordLockInfo(l)
	}
}

// ── P2: Replication Lag ──

func (c *Collector) collectReplicationLagAsync(ctx context.Context, conn *connsvc.Connection, now time.Time) {
	sourceDB, err := openSourceDB(conn)
	if err != nil {
		return
	}
	defer sourceDB.Close()

	switch conn.DBType {
	case "postgresql":
		c.collectPGReplicationLag(ctx, sourceDB, conn, now)
	case "mysql", "mariadb":
		c.collectMySQLReplicationLag(ctx, sourceDB, conn, now)
	}
}

func (c *Collector) collectPGReplicationLag(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) {
	// Check if this is a replica
	var inRecovery bool
	_ = db.QueryRowContext(ctx, `SELECT pg_is_in_recovery()`).Scan(&inRecovery)
	if !inRecovery {
		// Primary server — check if it has replicas
		rows, err := db.QueryContext(ctx, `
			SELECT
				COALESCE(application_name, ''),
				COALESCE(client_addr::text, ''),
				COALESCE(state, ''),
				COALESCE(sync_state, ''),
				COALESCE(write_lag::text, ''),
				COALESCE(flush_lag::text, ''),
				COALESCE(replay_lag::text, '')
			FROM pg_stat_replication`)
		if err != nil {
			return
		}
		defer rows.Close()

		for rows.Next() {
			var r ReplicationLag
			var writeLag, flushLag, replayLag sql.NullString
			if err := rows.Scan(&r.ApplicationName, &r.ClientAddr, &r.State, &r.SyncState,
				&writeLag, &flushLag, &replayLag); err != nil {
				continue
			}
			r.Time = now
			r.ConnectionID = conn.ID
			r.DBType = conn.DBType
			// Parse lag durations from PostgreSQL interval format
			if writeLag.Valid {
				r.WriteLag = parseIntervalSeconds(writeLag.String)
			}
			if flushLag.Valid {
				r.FlushLag = parseIntervalSeconds(flushLag.String)
			}
			if replayLag.Valid {
				r.ReplayLag = parseIntervalSeconds(replayLag.String)
			}
			_ = c.store.RecordReplicationLag(r)
		}
	}
}

func (c *Collector) collectMySQLReplicationLag(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) {
	// Try SHOW REPLICA STATUS first (MySQL 8.4+), fallback to SHOW SLAVE STATUS
	rows, err := db.QueryContext(ctx, `SHOW REPLICA STATUS`)
	if err != nil {
		rows, err = db.QueryContext(ctx, `SHOW SLAVE STATUS`)
		if err != nil {
			return
		}
	}
	defer rows.Close()

	for rows.Next() {
		cols, err := rows.Columns()
		if err != nil {
			continue
		}
		vals := make([]sql.NullString, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}

		r := ReplicationLag{
			Time:         now,
			ConnectionID: conn.ID,
			DBType:       conn.DBType,
		}

		for i, col := range cols {
			if !vals[i].Valid {
				continue
			}
			switch col {
			case "Slave_IO_State":
				r.SlaveIOState = vals[i].String
			case "Slave_IO_Running":
				r.SlaveIOThread = vals[i].String
			case "Slave_SQL_Running":
				r.SlaveSQLThread = vals[i].String
			case "Seconds_Behind_Master":
				r.SecondsBehindMaster = parseInt(vals[i].String)
			case "Read_Master_Log_Pos":
				r.ReadMasterLogPos = parseInt64(vals[i].String)
			case "Exec_Master_Log_Pos":
				r.ExecMasterLogPos = parseInt64(vals[i].String)
			case "Relay_Master_Log_File":
				r.RelayMasterLogFile = vals[i].String
			case "Last_Errno":
				r.LastErrno = parseInt(vals[i].String)
			case "Last_Error":
				r.LastError = vals[i].String
			}
		}
		_ = c.store.RecordReplicationLag(r)
	}
}

// ── P2: Table-Level Metrics ──

func (c *Collector) collectTableMetricsAsync(ctx context.Context, conn *connsvc.Connection, now time.Time) {
	sourceDB, err := openSourceDB(conn)
	if err != nil {
		return
	}
	defer sourceDB.Close()

	switch conn.DBType {
	case "postgresql":
		c.collectPGTableMetrics(ctx, sourceDB, conn, now)
	case "mysql", "mariadb":
		c.collectMySQLTableMetrics(ctx, sourceDB, conn, now)
	}
}

func (c *Collector) collectPGTableMetrics(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			COALESCE(current_database(), '') as database_name,
			schemaname,
			relname,
			COALESCE(pg_table_size(relid), 0) as table_size,
			COALESCE(pg_indexes_size(relid), 0) as index_size,
			COALESCE(pg_total_relation_size(relid), 0) as total_size,
			COALESCE(n_live_tup, 0) as row_estimate,
			CASE WHEN (n_live_tup + n_dead_tup) > 0
				THEN ROUND(n_dead_tup::numeric / (n_live_tup + n_dead_tup) * 100, 2)
				ELSE 0
			END as dead_tuple_pct
		FROM pg_stat_user_tables
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		ORDER BY pg_total_relation_size(relid) DESC
		LIMIT 10`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var t TableMetric
		if err := rows.Scan(&t.DatabaseName, &t.SchemaName, &t.TableName,
			&t.TableSize, &t.IndexSize, &t.TotalSize, &t.RowEstimate,
			&t.DeadTupleRatio); err != nil {
			continue
		}
		t.Time = now
		t.ConnectionID = conn.ID
		t.DBType = conn.DBType
		t.Engine = "PostgreSQL"
		_ = c.store.RecordTableMetric(t)
	}
}

func (c *Collector) collectMySQLTableMetrics(ctx context.Context, db *sql.DB, conn *connsvc.Connection, now time.Time) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			TABLE_SCHEMA,
			TABLE_SCHEMA,
			TABLE_NAME,
			CAST(DATA_LENGTH AS SIGNED),
			CAST(INDEX_LENGTH AS SIGNED),
			CAST(DATA_LENGTH AS SIGNED) + CAST(INDEX_LENGTH AS SIGNED),
			TABLE_ROWS,
			ENGINE,
			TABLE_COLLATION
		FROM information_schema.tables
		WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
		ORDER BY DATA_LENGTH + INDEX_LENGTH DESC
		LIMIT 10`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var t TableMetric
		var engine, collation sql.NullString
		var tableRows sql.NullInt64
		if err := rows.Scan(&t.DatabaseName, &t.SchemaName, &t.TableName,
			&t.TableSize, &t.IndexSize, &t.TotalSize, &tableRows,
			&engine, &collation); err != nil {
			continue
		}
		t.Time = now
		t.ConnectionID = conn.ID
		t.DBType = conn.DBType
		if engine.Valid {
			t.Engine = engine.String
		}
		if collation.Valid {
			t.Collation = collation.String
		}
		if tableRows.Valid {
			t.RowEstimate = tableRows.Int64
		}
		_ = c.store.RecordTableMetric(t)
	}
}

// ── P2 Helpers ──

func parseIntervalSeconds(s string) float64 {
	if s == "" {
		return 0
	}
	// PostgreSQL interval format: "00:00:00.123456" or "1 day 02:30:00"
	var hours, minutes int
	var seconds float64
	n, _ := fmt.Sscanf(s, "%d:%d:%f", &hours, &minutes, &seconds)
	if n == 3 {
		return float64(hours)*3600 + float64(minutes)*60 + seconds
	}
	return 0
}

func parseInt(s string) int {
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}

func parseInt64(s string) int64 {
	var n int64
	fmt.Sscanf(s, "%d", &n)
	return n
}

// ── Helpers ──

func openSourceDB(conn *connsvc.Connection) (*sql.DB, error) {
	switch conn.DBType {
	case "postgresql":
		dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=%s connect_timeout=5",
			conn.Host, conn.Port, conn.Username, conn.Password, conn.SSLMode)
		return sql.Open("pgx", dsn)
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?tls=%s&timeout=5s&charset=utf8mb4",
			conn.Username, conn.Password, conn.Host, conn.Port, tlsModeForMySQL(conn.SSLMode))
		return sql.Open("mysql", dsn)
	case "mariadb":
		// MariaDB is MySQL-compatible with go-sql-driver
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?tls=%s&timeout=5s&charset=utf8mb4&multiStatements=true",
			conn.Username, conn.Password, conn.Host, conn.Port, tlsModeForMySQL(conn.SSLMode))
		return sql.Open("mysql", dsn)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", conn.DBType)
	}
}

func tlsModeForMySQL(mode string) string {
	switch mode {
	case "disable", "allow":
		return "false"
	default:
		return "skip-verify"
	}
}

func escapePGString(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}
