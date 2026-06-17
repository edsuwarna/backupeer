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
	NotifTargetIDs      []string   `json:"notif_target_ids"`   // notification target IDs
	NotifyOnSuccess     bool       `json:"notify_on_success"`
	NotifyOnFailure     bool       `json:"notify_on_failure"`
	CreatedAt           time.Time  `json:"created_at"`
}

// BackupTrend represents daily backup aggregation for analytics charts.
type BackupTrend struct {
	Date           string  `json:"date"`
	TotalBackups   int     `json:"total_backups"`
	SuccessCount   int     `json:"success_count"`
	FailedCount    int     `json:"failed_count"`
	AvgDurationMs  float64 `json:"avg_duration_ms"`
	TotalSizeBytes int64   `json:"total_size_bytes"`
}

// StaleBackupAlert flags a database that hasn't been backed up recently.
type StaleBackupAlert struct {
	ConnectionID     string     `json:"connection_id"`
	ConnectionName   string     `json:"connection_name"`
	DBType           string     `json:"db_type"`
	DatabaseID       string     `json:"database_id"`
	DatabaseName     string     `json:"database_name"`
	LastBackupAt     *time.Time `json:"last_backup_at,omitempty"`
	HoursSinceBackup float64    `json:"hours_since_backup"`
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
	ListTrends(days int) ([]BackupTrend, error)
	ListSlowest(limit int) ([]Backup, error)
	ListStaleConnections(hours int) ([]StaleBackupAlert, error)
}
