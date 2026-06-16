// Package backup — incremental backup engine abstraction.
package backup

import (
	"fmt"

	"github.com/edsuwarna/backupeer/internal/connection"
)

// IncrementalSchedule contains the minimum schedule fields needed by incremental engines.
type IncrementalSchedule struct {
	ID                string
	ConnectionID      string
	DatabaseID        string
	BackupType        string // full, incremental
	StorageProviderID string
	EncryptionEnabled bool
	EncryptionKeyID   string
}

// IncrementalEngine defines the interface for database-specific incremental backup tools.
// Each implementation wraps a mature tool (pgBackRest, XtraBackup, Mariabackup).
type IncrementalEngine interface {
	// DBType returns the database type this engine supports ("postgresql", "mysql", "mariadb").
	DBType() string

	// BackupFull performs a full backup of the entire database instance.
	// Returns storage metadata (tool-specific info like stanza/set/S3 paths).
	BackupFull(sch IncrementalSchedule, conn *connection.Connection, backupID string) (metadata map[string]string, err error)

	// BackupIncremental performs an incremental backup based on the last full backup.
	BackupIncremental(sch IncrementalSchedule, conn *connection.Connection, backupID string) (metadata map[string]string, err error)
}

// EncryptionService interface for what incremental engines need.
type EncryptionService interface {
	Encrypt(data []byte, keyID string) ([]byte, error)
	Decrypt(data []byte, keyID string) ([]byte, error)
	Checksum(data []byte) string
}

// IncrementalEngineRegistry holds all registered incremental engines.
type IncrementalEngineRegistry struct {
	engines map[string]IncrementalEngine
}

// NewIncrementalEngineRegistry creates a new registry.
func NewIncrementalEngineRegistry() *IncrementalEngineRegistry {
	return &IncrementalEngineRegistry{
		engines: make(map[string]IncrementalEngine),
	}
}

// Register adds an engine to the registry.
func (r *IncrementalEngineRegistry) Register(engine IncrementalEngine) {
	r.engines[engine.DBType()] = engine
}

// Get returns the engine for the given database type.
func (r *IncrementalEngineRegistry) Get(dbType string) (IncrementalEngine, error) {
	engine, ok := r.engines[dbType]
	if !ok {
		return nil, fmt.Errorf("no incremental engine for database type: %s", dbType)
	}
	return engine, nil
}

// HasEngine returns true if an engine is registered for the given database type.
func (r *IncrementalEngineRegistry) HasEngine(dbType string) bool {
	_, ok := r.engines[dbType]
	return ok
}

// List returns all registered database types with engines.
func (r *IncrementalEngineRegistry) List() []string {
	var types []string
	for t := range r.engines {
		types = append(types, t)
	}
	return types
}
