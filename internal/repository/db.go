// Package repository provides SQLite implementations of all domain repository interfaces.
package repository

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

// Open opens the SQLite database and runs migrations.
func Open(dataDir string, timeoutSec int) (*sql.DB, error) {
	path := fmt.Sprintf("%s/jagad.db", dataDir)
	db, err := sql.Open("sqlite3", fmt.Sprintf("%s?_journal_mode=WAL&_busy_timeout=%d", path, timeoutSec*1000))
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	db.SetMaxOpenConns(1) // SQLite only supports one writer
	db.SetMaxIdleConns(1)

	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
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
		created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS connection_databases (
		id              TEXT PRIMARY KEY,
		connection_id   TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
		db_name         TEXT NOT NULL,
		is_selected     INTEGER DEFAULT 1,
		size_bytes      INTEGER,
		created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(connection_id, db_name)
	);

	CREATE TABLE IF NOT EXISTS storage_providers (
		id                  TEXT PRIMARY KEY,
		name                TEXT NOT NULL,
		provider_type       TEXT NOT NULL DEFAULT 's3' CHECK(provider_type IN ('s3', 'r2', 'minio', 'gcs', 'b2', 's3-compat')),
		endpoint            TEXT NOT NULL,
		region              TEXT DEFAULT 'auto',
		bucket              TEXT NOT NULL,
		access_key_encrypted BLOB NOT NULL,
		secret_key_encrypted BLOB NOT NULL,
		path_style          INTEGER DEFAULT 1,
		is_default          INTEGER DEFAULT 0,
		created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
		enabled         INTEGER DEFAULT 1,
		created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
		size_bytes      INTEGER,
		encrypted_size_bytes INTEGER,
		encryption_algo TEXT DEFAULT 'aes-256-gcm',
		encryption_key_id TEXT,
		checksum        TEXT,
		encrypted_checksum TEXT,
		verified_at     TIMESTAMP,
		verify_status   TEXT CHECK(verify_status IN ('pending', 'passed', 'failed')),
		duration_ms     INTEGER,
		log_output      TEXT,
		started_at      TIMESTAMP,
		completed_at    TIMESTAMP,
		created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS restores (
		id              TEXT PRIMARY KEY,
		backup_id       TEXT NOT NULL REFERENCES backups(id),
		target_connection TEXT REFERENCES connections(id),
		status          TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed')),
		duration_ms     INTEGER,
		log_output      TEXT,
		created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS encryption_keys (
		id              TEXT PRIMARY KEY,
		alias           TEXT NOT NULL UNIQUE,
		key_derivation  TEXT NOT NULL CHECK(key_derivation IN ('env', 'vault', 'manual')),
		key_salt        TEXT NOT NULL,
		key_check       TEXT NOT NULL,
		created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		rotated_at      TIMESTAMP,
		is_active       INTEGER DEFAULT 1
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

	// Migration version tracking
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)

	applied := func(v int) bool {
		var count int
		_ = db.QueryRow(`SELECT COUNT(*) FROM _migrations WHERE version = ?`, v).Scan(&count)
		return count > 0
	}

	markApplied := func(v int) error {
		_, err := db.Exec(`INSERT OR IGNORE INTO _migrations (version) VALUES (?)`, v)
		return err
	}

	// Migration 1: update storage_providers CHECK constraint for new types (gcs, b2, s3-compat)
	if !applied(1) {
		// SQLite doesn't support ALTER TABLE for CHECK constraints, so we recreate.
		_, err = db.Exec(`PRAGMA foreign_keys=OFF`)
		if err != nil {
			return err
		}

		_, err = db.Exec(`CREATE TABLE IF NOT EXISTS storage_providers_v2 (
			id                  TEXT PRIMARY KEY,
			name                TEXT NOT NULL,
			provider_type       TEXT NOT NULL DEFAULT 's3' CHECK(provider_type IN ('s3', 'r2', 'minio', 'gcs', 'b2', 's3-compat')),
			endpoint            TEXT NOT NULL,
			region              TEXT DEFAULT 'auto',
			bucket              TEXT NOT NULL,
			access_key_encrypted BLOB NOT NULL,
			secret_key_encrypted BLOB NOT NULL,
			path_style          INTEGER DEFAULT 1,
			is_default          INTEGER DEFAULT 0,
			created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`)
		if err != nil {
			return fmt.Errorf("migrate-1: create v2: %w", err)
		}

		_, _ = db.Exec(`INSERT OR IGNORE INTO storage_providers_v2 SELECT * FROM storage_providers`)
		_, _ = db.Exec(`DROP TABLE IF EXISTS storage_providers_old`)
		_, _ = db.Exec(`ALTER TABLE storage_providers RENAME TO storage_providers_old`)
		_, _ = db.Exec(`ALTER TABLE storage_providers_v2 RENAME TO storage_providers`)
		_, _ = db.Exec(`DROP TABLE IF EXISTS storage_providers_old`)
		_, _ = db.Exec(`PRAGMA foreign_keys=ON`)

		if err := markApplied(1); err != nil {
			return fmt.Errorf("migrate-1: mark applied: %w", err)
		}
	}

	// Migration 2: create notifications table
	if !applied(2) {
		_, err = db.Exec(`CREATE TABLE IF NOT EXISTS notifications (
			id              TEXT PRIMARY KEY,
			name            TEXT NOT NULL,
			notif_type      TEXT NOT NULL CHECK(notif_type IN ('telegram', 'discord', 'slack')),
			config_json     TEXT NOT NULL,
			notify_on_success INTEGER DEFAULT 1,
			notify_on_failure INTEGER DEFAULT 1,
			enabled         INTEGER DEFAULT 1,
			created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`)
		if err != nil {
			return fmt.Errorf("migrate-2: create notifications: %w", err)
		}
		if err := markApplied(2); err != nil {
			return fmt.Errorf("migrate-2: mark applied: %w", err)
		}
	}

	// Migration 3: simplify notifications table — remove notify_on_success, notify_on_failure, enabled
	if !applied(3) {
		_, err = db.Exec(`PRAGMA foreign_keys=OFF`)
		if err != nil {
			return err
		}

		_, err = db.Exec(`CREATE TABLE IF NOT EXISTS notifications_v3 (
			id              TEXT PRIMARY KEY,
			name            TEXT NOT NULL,
			notif_type      TEXT NOT NULL CHECK(notif_type IN ('telegram', 'discord', 'slack')),
			config_json     TEXT NOT NULL,
			created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`)
		if err != nil {
			return fmt.Errorf("migrate-3: create v3: %w", err)
		}

		// Migrate data (drop extra columns, keep only the columns that exist in v3)
		_, _ = db.Exec(`INSERT OR IGNORE INTO notifications_v3 (id, name, notif_type, config_json, created_at, updated_at) SELECT id, name, notif_type, config_json, created_at, updated_at FROM notifications`)
		_, _ = db.Exec(`DROP TABLE IF EXISTS notifications_old`)
		_, _ = db.Exec(`ALTER TABLE notifications RENAME TO notifications_old`)
		_, _ = db.Exec(`ALTER TABLE notifications_v3 RENAME TO notifications`)
		_, _ = db.Exec(`DROP TABLE IF EXISTS notifications_old`)
		_, _ = db.Exec(`PRAGMA foreign_keys=ON`)

		if err := markApplied(3); err != nil {
			return fmt.Errorf("migrate-3: mark applied: %w", err)
		}
	}

	// Migration 4: add notification columns to backups and schedules
	if !applied(4) {
		alts := []string{
			`ALTER TABLE backups ADD COLUMN notif_target_ids TEXT DEFAULT '[]'`,
			`ALTER TABLE backups ADD COLUMN notify_on_success INTEGER DEFAULT 1`,
			`ALTER TABLE backups ADD COLUMN notify_on_failure INTEGER DEFAULT 1`,
			`ALTER TABLE schedules ADD COLUMN notif_target_ids TEXT DEFAULT '[]'`,
			`ALTER TABLE schedules ADD COLUMN notify_on_success INTEGER DEFAULT 1`,
			`ALTER TABLE schedules ADD COLUMN notify_on_failure INTEGER DEFAULT 1`,
		}
		for _, alt := range alts {
			if _, err := db.Exec(alt); err != nil && strings.Contains(err.Error(), "duplicate column name") {
				// column already exists — that's fine
			} else if err != nil {
				return fmt.Errorf("migrate-4: %s: %w", alt[:60], err)
			}
		}

		if err := markApplied(4); err != nil {
			return fmt.Errorf("migrate-4: mark applied: %w", err)
		}
	}

	// Migration 5: app settings table
	if !applied(5) {
		_, err := db.Exec(`CREATE TABLE IF NOT EXISTS app_settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`)
		if err != nil {
			return fmt.Errorf("migrate-5: create app_settings: %w", err)
		}

		// Seed defaults
		defaults := map[string]string{
			"retention_full_default":  "7",
			"retention_incr_default":  "30",
			"concurrent_backups":      "2",
			"compression":             "gzip",
			"timezone":                "UTC",
			"notify_on_success":       "true",
			"notify_on_failure":       "true",
		}
		for k, v := range defaults {
			_, _ = db.Exec(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, k, v)
		}

		if err := markApplied(5); err != nil {
			return fmt.Errorf("migrate-5: mark applied: %w", err)
		}
	}

	return nil
}
