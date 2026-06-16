// Package restore defines the restore operation domain model and repository interface.
package restore

import "time"

// Restore represents a single restore operation from a backup.
type Restore struct {
	ID               string     `json:"id"`
	BackupID         string     `json:"backup_id"`
	TargetConnection *string    `json:"target_connection,omitempty"`
	Status           string     `json:"status"` // running, success, failed
	DurationMs       *int64     `json:"duration_ms,omitempty"`
	LogOutput        string     `json:"log_output,omitempty"`
	StartedAt        *time.Time `json:"started_at,omitempty"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}

// Repository defines the persistence contract for restores.
type Repository interface {
	List() ([]Restore, error)
	GetByID(id string) (*Restore, error)
	Create(r *Restore) error
	Update(r *Restore) error
}
