package postgres

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/edsuwarna/jagad/internal/schedule"
	"github.com/google/uuid"
)

// ScheduleRepo implements schedule.Repository using PostgreSQL.
type ScheduleRepo struct {
	db *sql.DB
}

func NewScheduleRepo(db *sql.DB) *ScheduleRepo {
	return &ScheduleRepo{db: db}
}

const scheduleCols = `id, connection_id, database_id, backup_type, cron_expr, storage_provider_id,
	encryption_enabled, encryption_key_id, verify_enabled,
	retention_full, retention_incr, notif_target_ids, notify_on_success, notify_on_failure, enabled, created_at`

func (r *ScheduleRepo) List() ([]schedule.Schedule, error) {
	rows, err := r.db.Query(`SELECT ` + scheduleCols + ` FROM schedules ORDER BY created_at DESC`)
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
	rows, err := r.db.Query(`SELECT `+scheduleCols+` FROM schedules WHERE connection_id = $1 ORDER BY created_at DESC`, connectionID)
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
	var encryptionEnabled, verifyEnabled, enabled, notifOnSuccess, notifOnFailure int
	var notifIDs string

	err := r.db.QueryRow(`SELECT `+scheduleCols+` FROM schedules WHERE id = $1`, id).
		Scan(&s.ID, &s.ConnectionID, &s.DatabaseID, &s.BackupType, &s.CronExpr,
			&s.StorageProviderID, &encryptionEnabled, &s.EncryptionKeyID, &verifyEnabled,
			&s.RetentionFull, &s.RetentionIncr, &notifIDs, &notifOnSuccess, &notifOnFailure, &enabled, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get schedule %s: %w", id, err)
	}
	s.EncryptionEnabled = encryptionEnabled == 1
	s.VerifyEnabled = verifyEnabled == 1
	s.Enabled = enabled == 1
	s.NotifyOnSuccess = notifOnSuccess == 1
	s.NotifyOnFailure = notifOnFailure == 1
	json.Unmarshal([]byte(notifIDs), &s.NotifTargetIDs)
	return &s, nil
}

func (r *ScheduleRepo) Create(s *schedule.Schedule) error {
	s.ID = uuid.New().String()
	s.CreatedAt = time.Now()

	ee := boolToInt(s.EncryptionEnabled)
	ve := boolToInt(s.VerifyEnabled)
	en := boolToInt(s.Enabled)
	nos := boolToInt(s.NotifyOnSuccess)
	nof := boolToInt(s.NotifyOnFailure)
	notifIDs := marshalStringSlice(s.NotifTargetIDs)

	_, err := r.db.Exec(`INSERT INTO schedules (id, connection_id, database_id, backup_type, cron_expr, storage_provider_id,
		encryption_enabled, encryption_key_id, verify_enabled,
		retention_full, retention_incr, notif_target_ids, notify_on_success, notify_on_failure, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
		s.ID, s.ConnectionID, s.DatabaseID, s.BackupType, s.CronExpr, s.StorageProviderID,
		ee, s.EncryptionKeyID, ve, s.RetentionFull, s.RetentionIncr, notifIDs, nos, nof, en, s.CreatedAt)
	if err != nil {
		return fmt.Errorf("create schedule: %w", err)
	}
	return nil
}

func (r *ScheduleRepo) Update(s *schedule.Schedule) error {
	ee := boolToInt(s.EncryptionEnabled)
	ve := boolToInt(s.VerifyEnabled)
	en := boolToInt(s.Enabled)
	nos := boolToInt(s.NotifyOnSuccess)
	nof := boolToInt(s.NotifyOnFailure)
	notifIDs := marshalStringSlice(s.NotifTargetIDs)

	_, err := r.db.Exec(`UPDATE schedules SET backup_type=$1, cron_expr=$2, storage_provider_id=$3,
		encryption_enabled=$4, encryption_key_id=$5, verify_enabled=$6,
		retention_full=$7, retention_incr=$8, notif_target_ids=$9, notify_on_success=$10, notify_on_failure=$11, enabled=$12 WHERE id=$13`,
		s.BackupType, s.CronExpr, s.StorageProviderID,
		ee, s.EncryptionKeyID, ve, s.RetentionFull, s.RetentionIncr, notifIDs, nos, nof, en, s.ID)
	if err != nil {
		return fmt.Errorf("update schedule %s: %w", s.ID, err)
	}
	return nil
}

func (r *ScheduleRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM schedules WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete schedule %s: %w", id, err)
	}
	return nil
}

func scanSchedule(rows *sql.Rows) (schedule.Schedule, error) {
	var s schedule.Schedule
	var encryptionEnabled, verifyEnabled, enabled, notifOnSuccess, notifOnFailure int
	var notifIDs string
	err := rows.Scan(&s.ID, &s.ConnectionID, &s.DatabaseID, &s.BackupType, &s.CronExpr,
		&s.StorageProviderID, &encryptionEnabled, &s.EncryptionKeyID, &verifyEnabled,
		&s.RetentionFull, &s.RetentionIncr, &notifIDs, &notifOnSuccess, &notifOnFailure, &enabled, &s.CreatedAt)
	if err != nil {
		return s, fmt.Errorf("scan schedule: %w", err)
	}
	s.EncryptionEnabled = encryptionEnabled == 1
	s.VerifyEnabled = verifyEnabled == 1
	s.Enabled = enabled == 1
	s.NotifyOnSuccess = notifOnSuccess == 1
	s.NotifyOnFailure = notifOnFailure == 1
	json.Unmarshal([]byte(notifIDs), &s.NotifTargetIDs)
	return s, nil
}


