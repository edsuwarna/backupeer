// Package connection defines the Connection and ConnectionDatabase domain models
// and repository interface for managing database server connections.
package connection

import "time"

// Connection represents a database server connection (server-level).
type Connection struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	DBType    string    `json:"db_type"` // postgresql, mysql, mariadb
	Host      string    `json:"host"`
	Port      int       `json:"port"`
	Username  string    `json:"username"`
	Password  string    `json:"password,omitempty"` // encrypted at rest, omitted in API responses
	SSLMode   string    `json:"ssl_mode"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ConnectionDatabase represents a discovered database within a connection.
type ConnectionDatabase struct {
	ID           string    `json:"id"`
	ConnectionID string    `json:"connection_id"`
	DBName       string    `json:"db_name"`
	IsSelected   bool      `json:"is_selected"`
	SizeBytes    int64     `json:"size_bytes,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// Repository defines the persistence contract for connections and databases.
// Implementations: sqlite, postgres, mock.
type Repository interface {
	// Connections
	List() ([]Connection, error)
	GetByID(id string) (*Connection, error)
	Create(conn *Connection) error
	Update(conn *Connection) error
	Delete(id string) error

	// Discovered databases
	ListDatabases(connectionID string) ([]ConnectionDatabase, error)
	GetDatabase(id string) (*ConnectionDatabase, error)
	UpsertDatabases(dbs []ConnectionDatabase) error
	UpdateDatabaseSelection(id string, selected bool) error
}
