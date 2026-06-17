// Package postgres provides PostgreSQL+TimescaleDB implementations of all domain repository interfaces.
package postgres

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Open opens a PostgreSQL+TimescaleDB connection and runs schema migrations.
func Open(dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test connectivity
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	if err := createHypertables(db); err != nil {
		return nil, fmt.Errorf("create hypertables: %w", err)
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS connections (
		id          TEXT PRIMARY KEY,
		name        TEXT NOT NULL,
		db_type     TEXT NOT NULL CHECK(db_type IN ('postgresql', 'mysql', 'mariadb')),
		host        TEXT NOT NULL,
		port        INTEGER NOT NULL,
		username    TEXT NOT NULL,
		password    TEXT NOT NULL,
		ssl_mode    TEXT DEFAULT 'prefer',
		created_at  TIMESTAMPTZ DEFAULT NOW(),
		updated_at  TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS connection_databases (
		id              TEXT PRIMARY KEY,
		connection_id   TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
		db_name         TEXT NOT NULL,
		is_selected     INTEGER DEFAULT 1,
		size_bytes      BIGINT,
		created_at      TIMESTAMPTZ DEFAULT NOW(),
		UNIQUE(connection_id, db_name)
	);

	CREATE TABLE IF NOT EXISTS storage_providers (
		id                  TEXT PRIMARY KEY,
		name                TEXT NOT NULL,
		provider_type       TEXT NOT NULL DEFAULT 's3' CHECK(provider_type IN ('s3', 'r2', 'minio', 'gcs', 'b2', 's3-compat')),
		endpoint            TEXT NOT NULL,
		region              TEXT DEFAULT 'auto',
		bucket              TEXT NOT NULL,
		access_key_encrypted BYTEA NOT NULL,
		secret_key_encrypted BYTEA NOT NULL,
		path_style          INTEGER DEFAULT 1,
		is_default          INTEGER DEFAULT 0,
		created_at          TIMESTAMPTZ DEFAULT NOW(),
		updated_at          TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS schedules (
		id              TEXT PRIMARY KEY,
		connection_id   TEXT NOT NULL REFERENCES connections(id),
		database_id     TEXT NOT NULL REFERENCES connection_databases(id),
		backup_type     TEXT NOT NULL CHECK(backup_type IN ('full', 'incremental')),
		cron_expr       TEXT NOT NULL,
		storage_provider_id TEXT REFERENCES storage_providers(id),
		encryption_enabled INTEGER DEFAULT 1,
		encryption_key_id TEXT,
		verify_enabled  INTEGER DEFAULT 0,
		retention_full  INTEGER DEFAULT 7,
		retention_incr  INTEGER DEFAULT 30,
		notif_target_ids TEXT DEFAULT '[]',
		notify_on_success INTEGER DEFAULT 1,
		notify_on_failure INTEGER DEFAULT 1,
		enabled         INTEGER DEFAULT 1,
		created_at      TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS backups (
		id              TEXT PRIMARY KEY,
		connection_id   TEXT NOT NULL REFERENCES connections(id),
		database_id     TEXT NOT NULL REFERENCES connection_databases(id),
		schedule_id     TEXT REFERENCES schedules(id),
		backup_type     TEXT NOT NULL CHECK(backup_type IN ('full', 'incremental')),
		status          TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed', 'verifying')),
		storage_path    TEXT NOT NULL,
		storage_provider_id TEXT REFERENCES storage_providers(id),
		size_bytes      BIGINT,
		encrypted_size_bytes BIGINT,
		encryption_algo TEXT DEFAULT 'aes-256-gcm',
		encryption_key_id TEXT,
		checksum        TEXT,
		encrypted_checksum TEXT,
		verified_at     TIMESTAMPTZ,
		verify_status   TEXT CHECK(verify_status IN ('pending', 'passed', 'failed')),
		duration_ms     BIGINT,
		log_output      TEXT,
		notif_target_ids TEXT DEFAULT '[]',
		notify_on_success INTEGER DEFAULT 1,
		notify_on_failure INTEGER DEFAULT 1,
		started_at      TIMESTAMPTZ,
		completed_at    TIMESTAMPTZ,
		created_at      TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS restores (
		id              TEXT PRIMARY KEY,
		backup_id       TEXT NOT NULL REFERENCES backups(id),
		target_connection TEXT REFERENCES connections(id),
		status          TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed')),
		duration_ms     BIGINT,
		log_output      TEXT,
		started_at      TIMESTAMPTZ,
		completed_at    TIMESTAMPTZ,
		created_at      TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS notifications (
		id              TEXT PRIMARY KEY,
		name            TEXT NOT NULL,
		notif_type      TEXT NOT NULL CHECK(notif_type IN ('telegram', 'discord', 'slack')),
		config_json     TEXT NOT NULL,
		created_at      TIMESTAMPTZ DEFAULT NOW(),
		updated_at      TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS encryption_keys (
		id              TEXT PRIMARY KEY,
		alias           TEXT NOT NULL UNIQUE,
		key_derivation  TEXT NOT NULL CHECK(key_derivation IN ('env', 'vault', 'manual')),
		key_salt        TEXT NOT NULL,
		key_check       TEXT NOT NULL,
		created_at      TIMESTAMPTZ DEFAULT NOW(),
		rotated_at      TIMESTAMPTZ,
		is_active       INTEGER DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS app_settings (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_conn_db_connection ON connection_databases(connection_id);
	CREATE INDEX IF NOT EXISTS idx_backups_connection ON backups(connection_id);
	CREATE INDEX IF NOT EXISTS idx_backups_database ON backups(database_id);
	CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
	CREATE INDEX IF NOT EXISTS idx_schedules_connection ON schedules(connection_id);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return err
	}

	// Add new columns if not exist (for existing deployments)
	_, _ = db.Exec(`ALTER TABLE db_metrics ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 0`)
	_, _ = db.Exec(`ALTER TABLE db_metrics ADD COLUMN IF NOT EXISTS conn_usage_percent REAL DEFAULT 0`)

	// Seed default settings
	defaults := map[string]string{
		"retention_full_default": "7",
		"retention_incr_default": "30",
		"concurrent_backups":     "2",
		"compression":            "gzip",
		"timezone":               "UTC",
		"notify_on_success":      "true",
		"notify_on_failure":      "true",
	}
	for k, v := range defaults {
		_, _ = db.Exec(`INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, k, v)
	}

	return nil
}

func createHypertables(db *sql.DB) error {
	// Check if TimescaleDB extension is available
	var extExists bool
	err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')`).Scan(&extExists)
	if err != nil {
		// If we can't check, assume no hypertables needed
		return nil
	}
	if !extExists {
		return nil
	}

	hypertables := []struct {
		table string
		col   string
	}{
		{"health_checks", "time"},
		{"db_metrics", "time"},
		{"performance_metrics", "time"},
	}

	for _, ht := range hypertables {
		// First ensure the table exists
		_, err := db.Exec(fmt.Sprintf(`
			CREATE TABLE IF NOT EXISTS %s (
				time              TIMESTAMPTZ NOT NULL,
				connection_id     TEXT NOT NULL,
				status            TEXT,
				response_time_ms  INTEGER,
				active_connections INTEGER,
				db_size_bytes     BIGINT,
				growth_bytes      BIGINT,
				cache_hit_ratio   REAL,
				qps               INTEGER,
				connections_total INTEGER,
				query_id          TEXT,
				query_text        TEXT,
				mean_time_ms      REAL,
				total_time_ms     REAL,
				calls             INTEGER,
				rows_avg          REAL,
				db_type           TEXT,
				error_message     TEXT,
				metadata          JSONB
			)`, ht.table))
		if err != nil {
			return fmt.Errorf("create %s table: %w", ht.table, err)
		}

		// Convert to hypertable — safe to call even if already hypertable
		_, err = db.Exec(fmt.Sprintf(`SELECT create_hypertable('%s', '%s', if_not_exists => TRUE)`, ht.table, ht.col))
		if err != nil {
			// Hypertable creation might fail if table already has data or other constraints
			// We ignore the error since it's non-critical for existing deployments
			continue
		}

		// Add compression policy (compress data older than 7 days)
		_, _ = db.Exec(fmt.Sprintf(`SELECT add_compression_policy('%s', INTERVAL '7 days', if_not_exists => TRUE)`, ht.table))

		// Add retention policy (delete data older than 90 days)
		_, _ = db.Exec(fmt.Sprintf(`SELECT add_retention_policy('%s', INTERVAL '90 days', if_not_exists => TRUE)`, ht.table))
	}

	return nil
}
