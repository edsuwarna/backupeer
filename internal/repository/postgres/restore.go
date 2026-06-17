package postgres

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/edsuwarna/jagad/internal/restore"
	"github.com/google/uuid"
)

// RestoreRepo implements restore.Repository using PostgreSQL.
type RestoreRepo struct {
	db *sql.DB
}

func NewRestoreRepo(db *sql.DB) *RestoreRepo {
	return &RestoreRepo{db: db}
}

func (r *RestoreRepo) List() ([]restore.Restore, error) {
	rows, err := r.db.Query(`SELECT id, backup_id, target_connection, status, duration_ms, started_at, completed_at, created_at FROM restores ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list restores: %w", err)
	}
	defer rows.Close()

	rs := make([]restore.Restore, 0)
	for rows.Next() {
		var res restore.Restore
		var targetConn, duration sql.NullString
		var startedAt, completedAt sql.NullTime
		if err := rows.Scan(&res.ID, &res.BackupID, &targetConn, &res.Status, &duration, &startedAt, &completedAt, &res.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan restore: %w", err)
		}
		if targetConn.Valid {
			res.TargetConnection = &targetConn.String
		}
		if startedAt.Valid {
			res.StartedAt = &startedAt.Time
		}
		if completedAt.Valid {
			res.CompletedAt = &completedAt.Time
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
	var startedAt, completedAt sql.NullTime
	err := r.db.QueryRow(`SELECT id, backup_id, target_connection, status, duration_ms, started_at, completed_at, created_at FROM restores WHERE id = $1`, id).
		Scan(&res.ID, &res.BackupID, &targetConn, &res.Status, &duration, &startedAt, &completedAt, &res.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get restore %s: %w", id, err)
	}
	if targetConn.Valid {
		res.TargetConnection = &targetConn.String
	}
	if startedAt.Valid {
		res.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		res.CompletedAt = &completedAt.Time
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

	_, err := r.db.Exec(`INSERT INTO restores (id, backup_id, target_connection, status, duration_ms, started_at, completed_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		res.ID, res.BackupID, targetConn, res.Status, nullableInt64(res.DurationMs), nullableTime(res.StartedAt), nullableTime(res.CompletedAt), res.CreatedAt)
	if err != nil {
		return fmt.Errorf("create restore: %w", err)
	}
	return nil
}

func (r *RestoreRepo) Update(res *restore.Restore) error {
	_, err := r.db.Exec(`UPDATE restores SET status=$1, duration_ms=$2, log_output=$3, started_at=$4, completed_at=$5 WHERE id=$6`,
		res.Status, nullableInt64(res.DurationMs), res.LogOutput, nullableTime(res.StartedAt), nullableTime(res.CompletedAt), res.ID)
	if err != nil {
		return fmt.Errorf("update restore %s: %w", res.ID, err)
	}
	return nil
}


