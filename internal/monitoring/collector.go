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
		err := db.QueryRowContext(ctx, `SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME = 'Threads_connected'`).Scan(&count)
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
		_ = db.QueryRowContext(ctx, `SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME = 'Threads_connected'`).Scan(&m.ConnectionsTotal)

		// Max connections and usage percentage
		_ = db.QueryRowContext(ctx, `SELECT @@max_connections`).Scan(&m.MaxConnections)
		if m.MaxConnections > 0 {
			m.ConnUsagePercent = float64(m.ConnectionsTotal) / float64(m.MaxConnections) * 100
		}

		// Cache hit ratio (InnoDB buffer pool)
		var hitRate sql.NullFloat64
		err = db.QueryRowContext(ctx, `
			SELECT 
				CASE WHEN COALESCE(INNODB_BUFFER_POOL_READS, 0) > 0 
					THEN ROUND((1 - (INNODB_BUFFER_POOL_READS / (INNODB_BUFFER_POOL_READ_REQUESTS + 1))) * 100, 2)
					ELSE 100 
				END
			FROM (SELECT 
				(SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME LIKE '%Innodb_buffer_pool_reads%' LIMIT 1)::INTEGER as INNODB_BUFFER_POOL_READS,
				(SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME LIKE '%Innodb_buffer_pool_read_requests%' LIMIT 1)::INTEGER as INNODB_BUFFER_POOL_READ_REQUESTS
			) stats`,
		).Scan(&hitRate)
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

// ── Helpers ──

func openSourceDB(conn *connsvc.Connection) (*sql.DB, error) {
	switch conn.DBType {
	case "postgresql":
		dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=%s connect_timeout=5",
			conn.Host, conn.Port, conn.Username, conn.Password, conn.SSLMode)
		return sql.Open("pgx", dsn)
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?tls=%s&timeout=5s&charset=utf8mb4",
			conn.Username, conn.Password, conn.Host, conn.Port, conn.SSLMode)
		return sql.Open("mysql", dsn)
	case "mariadb":
		// MariaDB is MySQL-compatible with go-sql-driver
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?tls=%s&timeout=5s&charset=utf8mb4&multiStatements=true",
			conn.Username, conn.Password, conn.Host, conn.Port, conn.SSLMode)
		return sql.Open("mysql", dsn)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", conn.DBType)
	}
}

func escapePGString(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}
