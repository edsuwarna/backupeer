// Package backup defines the backup domain model and repository interface.
package backup

import "time"

// Backup represents a single backup run for one database.
type Backup struct {
	ID                  string     `json:"id"`
	ConnectionID        string     `json:"connection_id"`
	DatabaseID          string     `json:"database_id"`
	ScheduleID          *string    `json:"schedule_id,omitempty"`
	BackupType          string     `json:"backup_type"` // full, incremental
	Status              string     `json:"status"`      // running, success, failed, verifying
	StoragePath         string     `json:"storage_path"`
	StorageProviderID   *string    `json:"storage_provider_id,omitempty"`
	SizeBytes           *int64     `json:"size_bytes,omitempty"`
	EncryptedSizeBytes  *int64     `json:"encrypted_size_bytes,omitempty"`
	EncryptionAlgo      string     `json:"encryption_algo,omitempty"`
	EncryptionKeyID     *string    `json:"encryption_key_id,omitempty"`
	Checksum            string     `json:"checksum,omitempty"`
	EncryptedChecksum   string     `json:"encrypted_checksum,omitempty"`
	VerifiedAt          *time.Time `json:"verified_at,omitempty"`
	VerifyStatus        string     `json:"verify_status,omitempty"` // pending, passed, failed
	DurationMs          *int64     `json:"duration_ms,omitempty"`
	LogOutput           string     `json:"log_output,omitempty"`
	StartedAt           *time.Time `json:"started_at,omitempty"`
	CompletedAt         *time.Time `json:"completed_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

// Repository defines the persistence contract for backups.
type Repository interface {
	List(connectionID, databaseID string, limit, offset int) ([]Backup, error)
	GetByID(id string) (*Backup, error)
	Create(b *Backup) error
	Update(b *Backup) error
	Delete(id string) error
	Count(connectionID, databaseID string) (int, error)
	ListBySchedule(scheduleID string) ([]Backup, error)
	ListOldestByBackupType(scheduleID, backupType string, keepCount int) ([]Backup, error)
}
