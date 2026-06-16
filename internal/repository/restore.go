package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/edsuwarna/backupeer/internal/restore"
	"github.com/google/uuid"
)

// RestoreRepo implements restore.Repository using SQLite.
type RestoreRepo struct {
	db *sql.DB
}

func NewRestoreRepo(db *sql.DB) *RestoreRepo {
	return &RestoreRepo{db: db}
}

func (r *RestoreRepo) List() ([]restore.Restore, error) {
	rows, err := r.db.Query(`SELECT id, backup_id, target_connection, status, duration_ms, created_at FROM restores ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list restores: %w", err)
	}
	defer rows.Close()

	var rs []restore.Restore
	for rows.Next() {
		var res restore.Restore
		var targetConn, duration sql.NullString
		if err := rows.Scan(&res.ID, &res.BackupID, &targetConn, &res.Status, &duration, &res.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan restore: %w", err)
		}
		if targetConn.Valid {
			res.TargetConnection = &targetConn.String
		}
		if v, err := parseInt64(duration.String); err == nil {
			res.DurationMs = &v
		}
		rs = append(rs, res)
	}
	return rs, nil
}

func (r *RestoreRepo) GetByID(id string) (*restore.Restore, error) {
	var res restore.Restore
	var targetConn, duration sql.NullString
	err := r.db.QueryRow(`SELECT id, backup_id, target_connection, status, duration_ms, created_at FROM restores WHERE id = ?`, id).
		Scan(&res.ID, &res.BackupID, &targetConn, &res.Status, &duration, &res.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get restore %s: %w", id, err)
	}
	if targetConn.Valid {
		res.TargetConnection = &targetConn.String
	}
	if v, err := parseInt64(duration.String); err == nil {
		res.DurationMs = &v
	}
	return &res, nil
}

func (r *RestoreRepo) Create(res *restore.Restore) error {
	res.ID = uuid.New().String()
	res.CreatedAt = time.Now()

	var targetConn interface{}
	if res.TargetConnection != nil {
		targetConn = *res.TargetConnection
	}

	_, err := r.db.Exec(`INSERT INTO restores (id, backup_id, target_connection, status, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		res.ID, res.BackupID, targetConn, res.Status, nullableInt64(res.DurationMs), res.CreatedAt)
	if err != nil {
		return fmt.Errorf("create restore: %w", err)
	}
	return nil
}

func (r *RestoreRepo) Update(res *restore.Restore) error {
	_, err := r.db.Exec(`UPDATE restores SET status=?, duration_ms=?, log_output=? WHERE id=?`,
		res.Status, nullableInt64(res.DurationMs), res.LogOutput, res.ID)
	if err != nil {
		return fmt.Errorf("update restore %s: %w", res.ID, err)
	}
	return nil
}
