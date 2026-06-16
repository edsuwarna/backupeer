package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/edsuwarna/backupeer/internal/backup"
	"github.com/google/uuid"
)

// BackupRepo implements backup.Repository using SQLite.
type BackupRepo struct {
	db *sql.DB
}

func NewBackupRepo(db *sql.DB) *BackupRepo {
	return &BackupRepo{db: db}
}

func (r *BackupRepo) List(connectionID, databaseID string, limit, offset int) ([]backup.Backup, error) {
	query := `SELECT id, connection_id, database_id, schedule_id, backup_type, status, storage_path,
		storage_provider_id, size_bytes, encrypted_size_bytes, encryption_algo, encryption_key_id,
		checksum, encrypted_checksum, verified_at, verify_status,
		duration_ms, started_at, completed_at, created_at
		FROM backups WHERE 1=1`
	var args []interface{}

	if connectionID != "" {
		query += fmt.Sprintf(" AND connection_id = ?%d", len(args)+1)
		args = append(args, connectionID)
	}
	if databaseID != "" {
		query += fmt.Sprintf(" AND database_id = ?%d", len(args)+1)
		args = append(args, databaseID)
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list backups: %w", err)
	}
	defer rows.Close()

	var bs []backup.Backup
	for rows.Next() {
		b, err := scanBackup(rows)
		if err != nil {
			return nil, err
		}
		bs = append(bs, b)
	}
	return bs, nil
}

func (r *BackupRepo) GetByID(id string) (*backup.Backup, error) {
	b := backup.Backup{}
	var storageProviderID, scheduleID, encKeyID, encryptedSize, sizeBytes, duration sql.NullString
	var verifiedAt, startedAt, completedAt sql.NullTime

	err := r.db.QueryRow(`SELECT id, connection_id, database_id, schedule_id, backup_type, status, storage_path,
		storage_provider_id, size_bytes, encrypted_size_bytes, encryption_algo, encryption_key_id,
		checksum, encrypted_checksum, verified_at, verify_status,
		duration_ms, started_at, completed_at, created_at
		FROM backups WHERE id = ?`, id).
		Scan(&b.ID, &b.ConnectionID, &b.DatabaseID, &scheduleID, &b.BackupType, &b.Status,
			&b.StoragePath, &storageProviderID, &sizeBytes, &encryptedSize, &b.EncryptionAlgo, &encKeyID,
			&b.Checksum, &b.EncryptedChecksum, &verifiedAt, &b.VerifyStatus,
			&duration, &startedAt, &completedAt, &b.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get backup %s: %w", id, err)
	}

	if scheduleID.Valid { b.ScheduleID = &scheduleID.String }
	if storageProviderID.Valid { b.StorageProviderID = &storageProviderID.String }
	if encKeyID.Valid { b.EncryptionKeyID = &encKeyID.String }
	if verifiedAt.Valid { b.VerifiedAt = &verifiedAt.Time }
	if startedAt.Valid { b.StartedAt = &startedAt.Time }
	if completedAt.Valid { b.CompletedAt = &completedAt.Time }
	if v, err := parseInt64(sizeBytes.String); err == nil { b.SizeBytes = &v }
	if v, err := parseInt64(encryptedSize.String); err == nil { b.EncryptedSizeBytes = &v }
	if v, err := parseInt64(duration.String); err == nil { b.DurationMs = &v }

	return &b, nil
}

func (r *BackupRepo) Create(b *backup.Backup) error {
	b.ID = uuid.New().String()
	b.CreatedAt = time.Now()

	_, err := r.db.Exec(`INSERT INTO backups (id, connection_id, database_id, schedule_id, backup_type, status,
		storage_path, storage_provider_id, size_bytes, encrypted_size_bytes, encryption_algo, encryption_key_id,
		checksum, encrypted_checksum, verify_status, duration_ms, started_at, completed_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		b.ID, b.ConnectionID, b.DatabaseID, nullableStr(b.ScheduleID), b.BackupType, b.Status,
		b.StoragePath, nullableStr(b.StorageProviderID), nullableInt64(b.SizeBytes), nullableInt64(b.EncryptedSizeBytes),
		b.EncryptionAlgo, nullableStr(b.EncryptionKeyID),
		b.Checksum, b.EncryptedChecksum, b.VerifyStatus,
		nullableInt64(b.DurationMs), nullableTime(b.StartedAt), nullableTime(b.CompletedAt), b.CreatedAt)
	if err != nil {
		return fmt.Errorf("create backup: %w", err)
	}
	return nil
}

func (r *BackupRepo) Update(b *backup.Backup) error {
	_, err := r.db.Exec(`UPDATE backups SET status=?, storage_path=?, storage_provider_id=?, size_bytes=?, encrypted_size_bytes=?,
		checksum=?, encrypted_checksum=?, verified_at=?, verify_status=?,
		duration_ms=?, log_output=?, completed_at=?
		WHERE id=?`,
		b.Status, b.StoragePath, nullableStr(b.StorageProviderID), nullableInt64(b.SizeBytes), nullableInt64(b.EncryptedSizeBytes),
		b.Checksum, b.EncryptedChecksum, nullableTime(b.VerifiedAt), b.VerifyStatus,
		nullableInt64(b.DurationMs), b.LogOutput, nullableTime(b.CompletedAt), b.ID)
	if err != nil {
		return fmt.Errorf("update backup %s: %w", b.ID, err)
	}
	return nil
}

func (r *BackupRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM backups WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete backup %s: %w", id, err)
	}
	return nil
}

// ListBySchedule returns backups for a given schedule, ordered oldest first.
func (r *BackupRepo) ListBySchedule(scheduleID string) ([]backup.Backup, error) {
	rows, err := r.db.Query(`SELECT id, connection_id, database_id, schedule_id, backup_type, status, storage_path,
		storage_provider_id, size_bytes, encrypted_size_bytes, encryption_algo, encryption_key_id,
		checksum, encrypted_checksum, verified_at, verify_status,
		duration_ms, started_at, completed_at, created_at
		FROM backups WHERE schedule_id = ? AND status = 'success' ORDER BY created_at ASC`, scheduleID)
	if err != nil {
		return nil, fmt.Errorf("list backups by schedule: %w", err)
	}
	defer rows.Close()

	var bs []backup.Backup
	for rows.Next() {
		b, err := scanBackup(rows)
		if err != nil {
			return nil, err
		}
		bs = append(bs, b)
	}
	return bs, nil
}

// ListOldestByBackupType returns the oldest backup IDs of a given type for a specific schedule.
func (r *BackupRepo) ListOldestByBackupType(scheduleID, backupType string, keepCount int) ([]backup.Backup, error) {
	rows, err := r.db.Query(`SELECT id, connection_id, database_id, schedule_id, backup_type, status, storage_path,
		storage_provider_id, size_bytes, encrypted_size_bytes, encryption_algo, encryption_key_id,
		checksum, encrypted_checksum, verified_at, verify_status,
		duration_ms, started_at, completed_at, created_at
		FROM backups WHERE schedule_id = ? AND backup_type = ? AND status = 'success'
		ORDER BY created_at ASC`, scheduleID, backupType)
	if err != nil {
		return nil, fmt.Errorf("list oldest backups: %w", err)
	}
	defer rows.Close()

	var bs []backup.Backup
	for rows.Next() {
		b, err := scanBackup(rows)
		if err != nil {
			return nil, err
		}
		bs = append(bs, b)
	}

	if len(bs) <= keepCount {
		return nil, nil
	}
	return bs[:len(bs)-keepCount], nil
}

func (r *BackupRepo) Count(connectionID, databaseID string) (int, error) {
	query := `SELECT COUNT(*) FROM backups WHERE 1=1`
	var args []interface{}

	if connectionID != "" {
		query += " AND connection_id = ?"
		args = append(args, connectionID)
	}
	if databaseID != "" {
		query += " AND database_id = ?"
		args = append(args, databaseID)
	}

	var count int
	err := r.db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count backups: %w", err)
	}
	return count, nil
}

// scanBackup scans a single row from rows iterator.
func scanBackup(rows *sql.Rows) (backup.Backup, error) {
	b := backup.Backup{}
	var storageProviderID, scheduleID, encKeyID, encryptedSize, sizeBytes, duration sql.NullString
	var verifiedAt, startedAt, completedAt sql.NullTime

	err := rows.Scan(&b.ID, &b.ConnectionID, &b.DatabaseID, &scheduleID, &b.BackupType, &b.Status,
		&b.StoragePath, &storageProviderID, &sizeBytes, &encryptedSize, &b.EncryptionAlgo, &encKeyID,
		&b.Checksum, &b.EncryptedChecksum, &verifiedAt, &b.VerifyStatus,
		&duration, &startedAt, &completedAt, &b.CreatedAt)
	if err != nil {
		return b, fmt.Errorf("scan backup: %w", err)
	}

	if scheduleID.Valid { b.ScheduleID = &scheduleID.String }
	if storageProviderID.Valid { b.StorageProviderID = &storageProviderID.String }
	if encKeyID.Valid { b.EncryptionKeyID = &encKeyID.String }
	if verifiedAt.Valid { b.VerifiedAt = &verifiedAt.Time }
	if startedAt.Valid { b.StartedAt = &startedAt.Time }
	if completedAt.Valid { b.CompletedAt = &completedAt.Time }
	if v, err := parseInt64(sizeBytes.String); err == nil { b.SizeBytes = &v }
	if v, err := parseInt64(encryptedSize.String); err == nil { b.EncryptedSizeBytes = &v }
	if v, err := parseInt64(duration.String); err == nil { b.DurationMs = &v }

	return b, nil
}

// Helper functions for nullable SQL fields.
func nullableStr(s *string) interface{} {
	if s == nil {
		return nil
	}
	return *s
}

func nullableInt64(i *int64) interface{} {
	if i == nil {
		return nil
	}
	return *i
}

func nullableTime(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return *t
}

func parseInt64(s string) (int64, error) {
	if s == "" {
		return 0, fmt.Errorf("empty string")
	}
	var v int64
	if _, err := fmt.Sscanf(s, "%d", &v); err != nil {
		return 0, err
	}
	return v, nil
}
