// Package connection provides business logic for managing database connections.
package connection

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
)

// Service handles connection management and database discovery.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create adds a new database connection and returns it with generated ID.
func (s *Service) Create(conn *Connection) error {
	// Default SSL mode
	if conn.SSLMode == "" {
		conn.SSLMode = "prefer"
	}

	// Validate
	if conn.Name == "" || conn.Host == "" || conn.Port == 0 {
		return fmt.Errorf("name, host, and port are required")
	}
	if conn.DBType != "postgresql" && conn.DBType != "mysql" && conn.DBType != "mariadb" {
		return fmt.Errorf("unsupported database type: %s", conn.DBType)
	}

	// Test connection before saving (basic validation)
	if err := testConnection(conn); err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}

	return s.repo.Create(conn)
}

// Update modifies an existing connection.
func (s *Service) Update(conn *Connection) error {
	if conn.ID == "" {
		return fmt.Errorf("id is required")
	}
	return s.repo.Update(conn)
}

// Delete removes a connection and all associated databases/schedules/backups (cascade).
func (s *Service) Delete(id string) error {
	return s.repo.Delete(id)
}

// Get retrieves a single connection by ID.
func (s *Service) Get(id string) (*Connection, error) {
	return s.repo.GetByID(id)
}

// List returns all connections.
func (s *Service) List() ([]Connection, error) {
	return s.repo.List()
}

// Discover runs database discovery on a connection and saves results.
func (s *Service) Discover(connectionID string) ([]ConnectionDatabase, error) {
	conn, err := s.repo.GetByID(connectionID)
	if err != nil {
		return nil, fmt.Errorf("get connection: %w", err)
	}
	if conn == nil {
		return nil, fmt.Errorf("connection not found: %s", connectionID)
	}

	names, err := discoverDatabases(conn)
	if err != nil {
		return nil, fmt.Errorf("discover databases: %w", err)
	}

	var dbs []ConnectionDatabase
	for _, name := range names {
		dbs = append(dbs, ConnectionDatabase{
			ConnectionID: connectionID,
			DBName:       name,
			IsSelected:   true,
		})
	}

	if err := s.repo.UpsertDatabases(dbs); err != nil {
		return nil, fmt.Errorf("save discovered databases: %w", err)
	}

	return s.repo.ListDatabases(connectionID)
}

// ListDatabases returns all discovered databases for a connection.
func (s *Service) ListDatabases(connectionID string) ([]ConnectionDatabase, error) {
	return s.repo.ListDatabases(connectionID)
}

// UpdateDatabaseSelection toggles whether a database is included in backups.
func (s *Service) UpdateDatabaseSelection(id string, selected bool) error {
	return s.repo.UpdateDatabaseSelection(id, selected)
}

// TestConnection verifies that a connection works.
func TestConnection(conn *Connection) error {
	return testConnection(conn)
}

func discoverDatabases(conn *Connection) ([]string, error) {
	// Generate random password for connection test if not provided
	switch conn.DBType {
	case "postgresql":
		return discoverPostgreSQL(conn)
	case "mysql", "mariadb":
		return discoverMySQL(conn)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", conn.DBType)
	}
}

func testConnection(conn *Connection) error {
	// For MVP, just try to open a connection and ping
	switch conn.DBType {
	case "postgresql":
		return testPostgreSQL(conn)
	case "mysql", "mariadb":
		return testMySQL(conn)
	default:
		return fmt.Errorf("unsupported database type: %s", conn.DBType)
	}
}

func testPostgreSQL(conn *Connection) error {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=%s connect_timeout=5",
		conn.Host, conn.Port, conn.Username, conn.Password, conn.SSLMode)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	defer db.Close()
	return db.Ping()
}

func testMySQL(conn *Connection) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?tls=%s&timeout=5s",
		conn.Username, conn.Password, conn.Host, conn.Port, conn.SSLMode)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	defer db.Close()
	return db.Ping()
}

func discoverPostgreSQL(conn *Connection) ([]string, error) {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=%s connect_timeout=5",
		conn.Host, conn.Port, conn.Username, conn.Password, conn.SSLMode)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, nil
}

func discoverMySQL(conn *Connection) ([]string, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?tls=%s&timeout=5s",
		conn.Username, conn.Password, conn.Host, conn.Port, conn.SSLMode)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(`SHOW DATABASES`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		// Filter system databases
		if name == "information_schema" || name == "performance_schema" || name == "mysql" || name == "sys" {
			continue
		}
		if strings.HasPrefix(name, "_") {
			continue
		}
		names = append(names, name)
	}
	return names, nil
}

// ctx is used for testing connections — in production use context.Background().
var ctx = context.Background()

// generateSecret creates a random hex string for encryption keys.
func generateSecret() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}
