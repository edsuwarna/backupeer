package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/edsuwarna/backupeer/internal/schedule"
	"github.com/google/uuid"
)

// ScheduleRepo implements schedule.Repository using SQLite.
type ScheduleRepo struct {
	db *sql.DB
}

func NewScheduleRepo(db *sql.DB) *ScheduleRepo {
	return &ScheduleRepo{db: db}
}

func (r *ScheduleRepo) List() ([]schedule.Schedule, error) {
	rows, err := r.db.Query(`SELECT id, connection_id, database_id, backup_type, cron_expr, storage_provider_id,
		encryption_enabled, encryption_key_id, verify_enabled,
		retention_full, retention_incr, enabled, created_at FROM schedules ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list schedules: %w", err)
	}
	defer rows.Close()

	var ss []schedule.Schedule
	for rows.Next() {
		s, err := scanSchedule(rows)
		if err != nil {
			return nil, err
		}
		ss = append(ss, s)
	}
	return ss, nil
}

func (r *ScheduleRepo) ListByConnection(connectionID string) ([]schedule.Schedule, error) {
	rows, err := r.db.Query(`SELECT id, connection_id, database_id, backup_type, cron_expr, storage_provider_id,
		encryption_enabled, encryption_key_id, verify_enabled,
		retention_full, retention_incr, enabled, created_at FROM schedules WHERE connection_id = ? ORDER BY created_at DESC`, connectionID)
	if err != nil {
		return nil, fmt.Errorf("list schedules by connection: %w", err)
	}
	defer rows.Close()

	var ss []schedule.Schedule
	for rows.Next() {
		s, err := scanSchedule(rows)
		if err != nil {
			return nil, err
		}
		ss = append(ss, s)
	}
	return ss, nil
}

func (r *ScheduleRepo) GetByID(id string) (*schedule.Schedule, error) {
	var s schedule.Schedule
	var encryptionEnabled, verifyEnabled, enabled int
	err := r.db.QueryRow(`SELECT id, connection_id, database_id, backup_type, cron_expr, storage_provider_id,
		encryption_enabled, encryption_key_id, verify_enabled,
		retention_full, retention_incr, enabled, created_at FROM schedules WHERE id = ?`, id).
		Scan(&s.ID, &s.ConnectionID, &s.DatabaseID, &s.BackupType, &s.CronExpr,
			&s.StorageProviderID, &encryptionEnabled, &s.EncryptionKeyID, &verifyEnabled,
			&s.RetentionFull, &s.RetentionIncr, &enabled, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get schedule %s: %w", id, err)
	}
	s.EncryptionEnabled = encryptionEnabled == 1
	s.VerifyEnabled = verifyEnabled == 1
	s.Enabled = enabled == 1
	return &s, nil
}

func (r *ScheduleRepo) Create(s *schedule.Schedule) error {
	s.ID = uuid.New().String()
	s.CreatedAt = time.Now()

	ee := boolToInt(s.EncryptionEnabled)
	ve := boolToInt(s.VerifyEnabled)
	en := boolToInt(s.Enabled)

	_, err := r.db.Exec(`INSERT INTO schedules (id, connection_id, database_id, backup_type, cron_expr, storage_provider_id,
		encryption_enabled, encryption_key_id, verify_enabled,
		retention_full, retention_incr, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.ConnectionID, s.DatabaseID, s.BackupType, s.CronExpr, s.StorageProviderID,
		ee, s.EncryptionKeyID, ve, s.RetentionFull, s.RetentionIncr, en, s.CreatedAt)
	if err != nil {
		return fmt.Errorf("create schedule: %w", err)
	}
	return nil
}

func (r *ScheduleRepo) Update(s *schedule.Schedule) error {
	ee := boolToInt(s.EncryptionEnabled)
	ve := boolToInt(s.VerifyEnabled)
	en := boolToInt(s.Enabled)

	_, err := r.db.Exec(`UPDATE schedules SET backup_type=?, cron_expr=?, storage_provider_id=?,
		encryption_enabled=?, encryption_key_id=?, verify_enabled=?,
		retention_full=?, retention_incr=?, enabled=? WHERE id=?`,
		s.BackupType, s.CronExpr, s.StorageProviderID,
		ee, s.EncryptionKeyID, ve, s.RetentionFull, s.RetentionIncr, en, s.ID)
	if err != nil {
		return fmt.Errorf("update schedule %s: %w", s.ID, err)
	}
	return nil
}

func (r *ScheduleRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM schedules WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete schedule %s: %w", id, err)
	}
	return nil
}

// scanSchedule scans a schedule row from rows iterator.
func scanSchedule(rows *sql.Rows) (schedule.Schedule, error) {
	var s schedule.Schedule
	var encryptionEnabled, verifyEnabled, enabled int
	err := rows.Scan(&s.ID, &s.ConnectionID, &s.DatabaseID, &s.BackupType, &s.CronExpr,
		&s.StorageProviderID, &encryptionEnabled, &s.EncryptionKeyID, &verifyEnabled,
		&s.RetentionFull, &s.RetentionIncr, &enabled, &s.CreatedAt)
	if err != nil {
		return s, fmt.Errorf("scan schedule: %w", err)
	}
	s.EncryptionEnabled = encryptionEnabled == 1
	s.VerifyEnabled = verifyEnabled == 1
	s.Enabled = enabled == 1
	return s, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
