// Package monitoring provides database health/performance monitoring services.
// It queries the managed source databases (not the local config DB) for metrics.
package monitoring

import (
	"database/sql"
	"time"
)

// HealthCheck represents a health check result for a database connection.
type HealthCheck struct {
	Time              time.Time `json:"time"`
	ConnectionID      string    `json:"connection_id"`
	Status            string    `json:"status"` // healthy, degraded, down
	ResponseTimeMs    int       `json:"response_time_ms"`
	ActiveConnections int       `json:"active_connections"`
	ErrorMessage      string    `json:"error_message,omitempty"`
}

// DBMetric represents database-level metrics (size, growth, etc.).
type DBMetric struct {
	Time              time.Time `json:"time"`
	ConnectionID      string    `json:"connection_id"`
	DBName            string    `json:"db_name"`
	DBType            string    `json:"db_type"`
	DBSizeBytes       int64     `json:"db_size_bytes"`
	GrowthBytes       int64     `json:"growth_bytes"`
	CacheHitRatio     float64   `json:"cache_hit_ratio"`
	QPS               int       `json:"qps"`
	ConnectionsTotal  int       `json:"connections_total"`
	MaxConnections    int       `json:"max_connections"`
	ConnUsagePercent  float64   `json:"conn_usage_percent"`
}

// PerformanceMetric represents a slow query or query performance snapshot.
type PerformanceMetric struct {
	Time         time.Time `json:"time"`
	ConnectionID string    `json:"connection_id"`
	DBType       string    `json:"db_type"`
	QueryID      string    `json:"query_id"`
	QueryText    string    `json:"query_text"`
	MeanTimeMs   float64   `json:"mean_time_ms"`
	TotalTimeMs  float64   `json:"total_time_ms"`
	Calls        int       `json:"calls"`
	RowsAvg      float64   `json:"rows_avg"`
}

// Store defines the monitoring data storage operations.
type Store interface {
	RecordHealthCheck(h HealthCheck) error
	RecordDBMetric(m DBMetric) error
	RecordPerformanceMetric(p PerformanceMetric) error

	QueryHealthChecks(connectionID string, since, until time.Time, limit int) ([]HealthCheck, error)
	QueryDBMetrics(connectionID string, since, until time.Time, limit int) ([]DBMetric, error)
	QueryPerformanceMetrics(connectionID string, since, until time.Time, limit int) ([]PerformanceMetric, error)
}

// PGStore implements Store using PostgreSQL/TimescaleDB.
type PGStore struct {
	db *sql.DB
}

func NewPGStore(db *sql.DB) *PGStore {
	return &PGStore{db: db}
}

func (s *PGStore) RecordHealthCheck(h HealthCheck) error {
	_, err := s.db.Exec(`INSERT INTO health_checks (time, connection_id, status, response_time_ms, active_connections, error_message)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		h.Time, h.ConnectionID, h.Status, h.ResponseTimeMs, h.ActiveConnections, nullableStr(h.ErrorMessage))
	return err
}

func (s *PGStore) RecordDBMetric(m DBMetric) error {
	_, err := s.db.Exec(`INSERT INTO db_metrics (time, connection_id, db_type, db_size_bytes, growth_bytes, cache_hit_ratio, qps, connections_total, max_connections, conn_usage_percent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		m.Time, m.ConnectionID, m.DBType, m.DBSizeBytes, m.GrowthBytes, m.CacheHitRatio, m.QPS, m.ConnectionsTotal, m.MaxConnections, m.ConnUsagePercent)
	return err
}

func (s *PGStore) RecordPerformanceMetric(p PerformanceMetric) error {
	_, err := s.db.Exec(`INSERT INTO performance_metrics (time, connection_id, db_type, query_id, query_text, mean_time_ms, total_time_ms, calls, rows_avg)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		p.Time, p.ConnectionID, p.DBType, p.QueryID, p.QueryText, p.MeanTimeMs, p.TotalTimeMs, p.Calls, p.RowsAvg)
	return err
}

func (s *PGStore) QueryHealthChecks(connectionID string, since, until time.Time, limit int) ([]HealthCheck, error) {
	query := `SELECT time, connection_id, status, COALESCE(response_time_ms, 0), COALESCE(active_connections, 0), COALESCE(error_message, '')
		FROM health_checks WHERE 1=1`
	var args []interface{}
	argIdx := 1

	if connectionID != "" {
		query += ` AND connection_id = $` + itoa(argIdx)
		args = append(args, connectionID)
		argIdx++
	}
	if !since.IsZero() {
		query += ` AND time >= $` + itoa(argIdx)
		args = append(args, since)
		argIdx++
	}
	if !until.IsZero() {
		query += ` AND time <= $` + itoa(argIdx)
		args = append(args, until)
		argIdx++
	}
	query += ` ORDER BY time DESC LIMIT $` + itoa(argIdx)
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []HealthCheck
	for rows.Next() {
		var h HealthCheck
		if err := rows.Scan(&h.Time, &h.ConnectionID, &h.Status, &h.ResponseTimeMs, &h.ActiveConnections, &h.ErrorMessage); err != nil {
			return nil, err
		}
		results = append(results, h)
	}
	return results, nil
}

func (s *PGStore) QueryDBMetrics(connectionID string, since, until time.Time, limit int) ([]DBMetric, error) {
	query := `SELECT time, connection_id, COALESCE(db_type, ''), COALESCE(db_size_bytes, 0), COALESCE(growth_bytes, 0),
		COALESCE(cache_hit_ratio, 0), COALESCE(qps, 0), COALESCE(connections_total, 0),
		COALESCE(max_connections, 0), COALESCE(conn_usage_percent, 0)
		FROM db_metrics WHERE 1=1`
	var args []interface{}
	argIdx := 1

	if connectionID != "" {
		query += ` AND connection_id = $` + itoa(argIdx)
		args = append(args, connectionID)
		argIdx++
	}
	if !since.IsZero() {
		query += ` AND time >= $` + itoa(argIdx)
		args = append(args, since)
		argIdx++
	}
	if !until.IsZero() {
		query += ` AND time <= $` + itoa(argIdx)
		args = append(args, until)
		argIdx++
	}
	query += ` ORDER BY time DESC LIMIT $` + itoa(argIdx)
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []DBMetric
	for rows.Next() {
		var m DBMetric
		if err := rows.Scan(&m.Time, &m.ConnectionID, &m.DBType, &m.DBSizeBytes, &m.GrowthBytes, &m.CacheHitRatio, &m.QPS, &m.ConnectionsTotal, &m.MaxConnections, &m.ConnUsagePercent); err != nil {
			return nil, err
		}
		results = append(results, m)
	}
	return results, nil
}

func (s *PGStore) QueryPerformanceMetrics(connectionID string, since, until time.Time, limit int) ([]PerformanceMetric, error) {
	query := `SELECT time, connection_id, COALESCE(db_type, ''), COALESCE(query_id, ''), COALESCE(query_text, ''),
		COALESCE(mean_time_ms, 0), COALESCE(total_time_ms, 0), COALESCE(calls, 0), COALESCE(rows_avg, 0)
		FROM performance_metrics WHERE 1=1`
	var args []interface{}
	argIdx := 1

	if connectionID != "" {
		query += ` AND connection_id = $` + itoa(argIdx)
		args = append(args, connectionID)
		argIdx++
	}
	if !since.IsZero() {
		query += ` AND time >= $` + itoa(argIdx)
		args = append(args, since)
		argIdx++
	}
	if !until.IsZero() {
		query += ` AND time <= $` + itoa(argIdx)
		args = append(args, until)
		argIdx++
	}
	query += ` ORDER BY mean_time_ms DESC LIMIT $` + itoa(argIdx)
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []PerformanceMetric
	for rows.Next() {
		var p PerformanceMetric
		if err := rows.Scan(&p.Time, &p.ConnectionID, &p.DBType, &p.QueryID, &p.QueryText, &p.MeanTimeMs, &p.TotalTimeMs, &p.Calls, &p.RowsAvg); err != nil {
			return nil, err
		}
		results = append(results, p)
	}
	return results, nil
}

func nullableStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var buf [20]byte
	pos := len(buf)
	for i > 0 {
		pos--
		buf[pos] = byte('0' + i%10)
		i /= 10
	}
	return string(buf[pos:])
}
