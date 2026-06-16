// Package repository provides SQLite implementations of all domain repository interfaces.
package repository

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

// Open opens the SQLite database and runs migrations.
func Open(dataDir string, timeoutSec int) (*sql.DB, error) {
	path := fmt.Sprintf("%s/backupeer.db", dataDir)
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
		provider_type       TEXT NOT NULL DEFAULT 's3' CHECK(provider_type IN ('s3', 'r2', 'minio')),
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
	return err
}
