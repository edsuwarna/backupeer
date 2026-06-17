package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/edsuwarna/jagad/internal/notification"
	"github.com/google/uuid"
)

// NotificationRepo implements notification.NotificationRepository using SQLite.
type NotificationRepo struct {
	db *sql.DB
}

func NewNotificationRepo(db *sql.DB) *NotificationRepo {
	return &NotificationRepo{db: db}
}

func (r *NotificationRepo) List() ([]notification.Notification, error) {
	rows, err := r.db.Query(`SELECT id, name, notif_type, config_json,
		created_at, updated_at FROM notifications ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	var ns []notification.Notification
	for rows.Next() {
		n, err := scanNotification(rows)
		if err != nil {
			return nil, err
		}
		ns = append(ns, n)
	}
	return ns, nil
}

func (r *NotificationRepo) GetByID(id string) (*notification.Notification, error) {
	n, err := scanNotificationRow(r.db.QueryRow(`SELECT id, name, notif_type, config_json,
		created_at, updated_at FROM notifications WHERE id = ?`, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get notification %s: %w", id, err)
	}
	return &n, nil
}

func (r *NotificationRepo) Create(n *notification.Notification) error {
	n.ID = uuid.New().String()
	n.CreatedAt = time.Now()
	n.UpdatedAt = n.CreatedAt

	_, err := r.db.Exec(`INSERT INTO notifications
		(id, name, notif_type, config_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		n.ID, n.Name, n.NotifType, n.ConfigJSON, n.CreatedAt, n.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create notification: %w", err)
	}
	return nil
}

func (r *NotificationRepo) Update(n *notification.Notification) error {
	n.UpdatedAt = time.Now()

	_, err := r.db.Exec(`UPDATE notifications SET
		name=?, notif_type=?, config_json=?, updated_at=? WHERE id=?`,
		n.Name, n.NotifType, n.ConfigJSON, n.UpdatedAt, n.ID)
	if err != nil {
		return fmt.Errorf("update notification %s: %w", n.ID, err)
	}
	return nil
}

func (r *NotificationRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM notifications WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete notification %s: %w", id, err)
	}
	return nil
}

func scanNotification(rows *sql.Rows) (notification.Notification, error) {
	var n notification.Notification
	err := rows.Scan(&n.ID, &n.Name, &n.NotifType, &n.ConfigJSON,
		&n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return n, fmt.Errorf("scan notification: %w", err)
	}
	return n, nil
}

func scanNotificationRow(row *sql.Row) (notification.Notification, error) {
	var n notification.Notification
	err := row.Scan(&n.ID, &n.Name, &n.NotifType, &n.ConfigJSON,
		&n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return n, err
	}
	return n, nil
}
