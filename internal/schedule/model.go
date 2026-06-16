// Package schedule defines the backup schedule domain model and repository interface.
package schedule

import "time"

// Schedule represents a cron-based backup schedule targeting one database.
type Schedule struct {
	ID                  string    `json:"id"`
	ConnectionID        string    `json:"connection_id"`
	DatabaseID          string    `json:"database_id"`
	BackupType          string    `json:"backup_type"` // full, incremental
	CronExpr            string    `json:"cron_expr"`
	StorageProviderID   string    `json:"storage_provider_id"`
	EncryptionEnabled   bool      `json:"encryption_enabled"`
	EncryptionKeyID     string    `json:"encryption_key_id,omitempty"`
	VerifyEnabled       bool      `json:"verify_enabled"`
	RetentionFull       int       `json:"retention_full"`
	RetentionIncr       int       `json:"retention_incr"`
	Enabled             bool      `json:"enabled"`
	CreatedAt           time.Time `json:"created_at"`
}

// Repository defines the persistence contract for schedules.
type Repository interface {
	List() ([]Schedule, error)
	ListByConnection(connectionID string) ([]Schedule, error)
	GetByID(id string) (*Schedule, error)
	Create(s *Schedule) error
	Update(s *Schedule) error
	Delete(id string) error
}
