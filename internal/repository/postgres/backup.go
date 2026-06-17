package postgres

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/edsuwarna/jagad/internal/backup"
	"github.com/google/uuid"
)

// BackupRepo implements backup.Repository using PostgreSQL.
type BackupRepo struct {
	db *sql.DB
}

func NewBackupRepo(db *sql.DB) *BackupRepo {
	return &BackupRepo{db: db}
}

const backupCols = `id, connection_id, database_id, schedule_id, backup_type, status, storage_path,
	storage_provider_id, size_bytes, encrypted_size_bytes, encryption_algo, encryption_key_id,
	checksum, encrypted_checksum, verified_at, verify_status,
	duration_ms, started_at, completed_at, notif_target_ids, notify_on_success, notify_on_failure, created_at`

func (r *BackupRepo) List(connectionID, databaseID string, limit, offset int) ([]backup.Backup, error) {
	query := `SELECT ` + backupCols + ` FROM backups WHERE 1=1`
	var args []interface{}
	argIdx := 1

	if connectionID != "" {
		query += fmt.Sprintf(" AND connection_id = $%d", argIdx)
		args = append(args, connectionID)
		argIdx++
	}
	if databaseID != "" {
		query += fmt.Sprintf(" AND database_id = $%d", argIdx)
		args = append(args, databaseID)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
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
	var notifIDs string
	var notifOnSuccess, notifOnFailure int

	err := r.db.QueryRow(`SELECT `+backupCols+` FROM backups WHERE id = $1`, id).
		Scan(&b.ID, &b.ConnectionID, &b.DatabaseID, &scheduleID, &b.BackupType, &b.Status,
			&b.StoragePath, &storageProviderID, &sizeBytes, &encryptedSize, &b.EncryptionAlgo, &encKeyID,
			&b.Checksum, &b.EncryptedChecksum, &verifiedAt, &b.VerifyStatus,
			&duration, &startedAt, &completedAt, &notifIDs, &notifOnSuccess, &notifOnFailure, &b.CreatedAt)
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

	json.Unmarshal([]byte(notifIDs), &b.NotifTargetIDs)
	b.NotifyOnSuccess = notifOnSuccess == 1
	b.NotifyOnFailure = notifOnFailure == 1

	return &b, nil
}

func (r *BackupRepo) Create(b *backup.Backup) error {
	b.ID = uuid.New().String()
	b.CreatedAt = time.Now()

	notifIDs := marshalStringSlice(b.NotifTargetIDs)
	notifOnSuccess := boolToInt(b.NotifyOnSuccess)
	notifOnFailure := boolToInt(b.NotifyOnFailure)

	_, err := r.db.Exec(`INSERT INTO backups (id, connection_id, database_id, schedule_id, backup_type, status,
		storage_path, storage_provider_id, size_bytes, encrypted_size_bytes, encryption_algo, encryption_key_id,
		checksum, encrypted_checksum, verify_status, duration_ms, started_at, completed_at,
		notif_target_ids, notify_on_success, notify_on_failure, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
		b.ID, b.ConnectionID, b.DatabaseID, nullableStr(b.ScheduleID), b.BackupType, b.Status,
		b.StoragePath, nullableStr(b.StorageProviderID), nullableInt64(b.SizeBytes), nullableInt64(b.EncryptedSizeBytes),
		b.EncryptionAlgo, nullableStr(b.EncryptionKeyID),
		b.Checksum, b.EncryptedChecksum, b.VerifyStatus,
		nullableInt64(b.DurationMs), nullableTime(b.StartedAt), nullableTime(b.CompletedAt),
		notifIDs, notifOnSuccess, notifOnFailure, b.CreatedAt)
	if err != nil {
		return fmt.Errorf("create backup: %w", err)
	}
	return nil
}

func (r *BackupRepo) Update(b *backup.Backup) error {
	_, err := r.db.Exec(`UPDATE backups SET status=$1, storage_path=$2, storage_provider_id=$3, size_bytes=$4, encrypted_size_bytes=$5,
		checksum=$6, encrypted_checksum=$7, verified_at=$8, verify_status=$9,
		duration_ms=$10, log_output=$11, completed_at=$12
		WHERE id=$13`,
		b.Status, b.StoragePath, nullableStr(b.StorageProviderID), nullableInt64(b.SizeBytes), nullableInt64(b.EncryptedSizeBytes),
		b.Checksum, b.EncryptedChecksum, nullableTime(b.VerifiedAt), b.VerifyStatus,
		nullableInt64(b.DurationMs), b.LogOutput, nullableTime(b.CompletedAt), b.ID)
	if err != nil {
		return fmt.Errorf("update backup %s: %w", b.ID, err)
	}
	return nil
}

func (r *BackupRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM backups WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete backup %s: %w", id, err)
	}
	return nil
}

func (r *BackupRepo) ListBySchedule(scheduleID string) ([]backup.Backup, error) {
	rows, err := r.db.Query(`SELECT `+backupCols+` FROM backups WHERE schedule_id = $1 AND status = 'success' ORDER BY created_at ASC`, scheduleID)
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

func (r *BackupRepo) ListOldestByBackupType(scheduleID, backupType string, keepCount int) ([]backup.Backup, error) {
	rows, err := r.db.Query(`SELECT `+backupCols+` FROM backups WHERE schedule_id = $1 AND backup_type = $2 AND status = 'success'
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
	argIdx := 1

	if connectionID != "" {
		query += fmt.Sprintf(" AND connection_id = $%d", argIdx)
		args = append(args, connectionID)
		argIdx++
	}
	if databaseID != "" {
		query += fmt.Sprintf(" AND database_id = $%d", argIdx)
		args = append(args, databaseID)
		argIdx++
	}

	var count int
	err := r.db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count backups: %w", err)
	}
	return count, nil
}

func (r *BackupRepo) ListTrends(days int) ([]backup.BackupTrend, error) {
	query := `SELECT
		DATE(created_at) as day,
		COUNT(*) as total,
		COUNT(*) FILTER (WHERE status = 'success') as successes,
		COUNT(*) FILTER (WHERE status = 'failed') as failures,
		COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL), 0) as avg_duration,
		COALESCE(SUM(size_bytes), 0) as total_size
	FROM backups
	WHERE created_at > NOW() - ($1 || ' days')::INTERVAL
	GROUP BY DATE(created_at)
	ORDER BY day ASC`

	rows, err := r.db.Query(query, fmt.Sprintf("%d", days))
	if err != nil {
		return nil, fmt.Errorf("list trends: %w", err)
	}
	defer rows.Close()

	var trends []backup.BackupTrend
	for rows.Next() {
		var t backup.BackupTrend
		if err := rows.Scan(&t.Date, &t.TotalBackups, &t.SuccessCount, &t.FailedCount, &t.AvgDurationMs, &t.TotalSizeBytes); err != nil {
			return nil, fmt.Errorf("scan trend: %w", err)
		}
		trends = append(trends, t)
	}
	if trends == nil {
		trends = []backup.BackupTrend{}
	}
	return trends, nil
}

func (r *BackupRepo) ListSlowest(limit int) ([]backup.Backup, error) {
	query := `SELECT ` + backupCols + ` FROM backups
		WHERE duration_ms IS NOT NULL AND status = 'success'
		ORDER BY duration_ms DESC
		LIMIT $1`

	rows, err := r.db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("list slowest: %w", err)
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
	if bs == nil {
		bs = []backup.Backup{}
	}
	return bs, nil
}

func (r *BackupRepo) ListStaleConnections(hours int) ([]backup.StaleBackupAlert, error) {
	query := `SELECT
		c.id,
		c.name,
		c.db_type,
		cd.id,
		cd.db_name,
		MAX(b.completed_at) as last_backup,
		EXTRACT(EPOCH FROM NOW() - MAX(b.completed_at)) / 3600 as hours_since
	FROM connections c
	JOIN connection_databases cd ON cd.connection_id = c.id AND cd.is_selected = 1
	LEFT JOIN backups b ON b.connection_id = c.id AND b.database_id = cd.id AND b.status = 'success'
	GROUP BY c.id, c.name, c.db_type, cd.id, cd.db_name
	HAVING MAX(b.completed_at) IS NULL
		OR EXTRACT(EPOCH FROM NOW() - MAX(b.completed_at)) / 3600 > $1
	ORDER BY hours_since DESC NULLS FIRST`

	rows, err := r.db.Query(query, hours)
	if err != nil {
		return nil, fmt.Errorf("list stale connections: %w", err)
	}
	defer rows.Close()

	var alerts []backup.StaleBackupAlert
	for rows.Next() {
		var a backup.StaleBackupAlert
		if err := rows.Scan(&a.ConnectionID, &a.ConnectionName, &a.DBType, &a.DatabaseID, &a.DatabaseName, &a.LastBackupAt, &a.HoursSinceBackup); err != nil {
			return nil, fmt.Errorf("scan stale alert: %w", err)
		}
		alerts = append(alerts, a)
	}
	if alerts == nil {
		alerts = []backup.StaleBackupAlert{}
	}
	return alerts, nil
}

func scanBackup(rows *sql.Rows) (backup.Backup, error) {
	b := backup.Backup{}
	var storageProviderID, scheduleID, encKeyID, encryptedSize, sizeBytes, duration sql.NullString
	var verifiedAt, startedAt, completedAt sql.NullTime
	var notifIDs string
	var notifOnSuccess, notifOnFailure int

	err := rows.Scan(&b.ID, &b.ConnectionID, &b.DatabaseID, &scheduleID, &b.BackupType, &b.Status,
		&b.StoragePath, &storageProviderID, &sizeBytes, &encryptedSize, &b.EncryptionAlgo, &encKeyID,
		&b.Checksum, &b.EncryptedChecksum, &verifiedAt, &b.VerifyStatus,
		&duration, &startedAt, &completedAt, &notifIDs, &notifOnSuccess, &notifOnFailure, &b.CreatedAt)
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

	json.Unmarshal([]byte(notifIDs), &b.NotifTargetIDs)
	b.NotifyOnSuccess = notifOnSuccess == 1
	b.NotifyOnFailure = notifOnFailure == 1

	return b, nil
}

// Helper functions shared across postgres repos.

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

func marshalStringSlice(s []string) string {
	if s == nil {
		return "[]"
	}
	data, _ := json.Marshal(s)
	return string(data)
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
