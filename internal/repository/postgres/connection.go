package postgres

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/edsuwarna/jagad/internal/connection"
	"github.com/google/uuid"
)

// ConnectionRepo implements connection.Repository using PostgreSQL.
type ConnectionRepo struct {
	db *sql.DB
}

func NewConnectionRepo(db *sql.DB) *ConnectionRepo {
	return &ConnectionRepo{db: db}
}

func (r *ConnectionRepo) List() ([]connection.Connection, error) {
	rows, err := r.db.Query(`SELECT id, name, db_type, host, port, username, ssl_mode, created_at, updated_at FROM connections ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list connections: %w", err)
	}
	defer rows.Close()

	var conns []connection.Connection
	for rows.Next() {
		var c connection.Connection
		if err := rows.Scan(&c.ID, &c.Name, &c.DBType, &c.Host, &c.Port, &c.Username, &c.SSLMode, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan connection: %w", err)
		}
		conns = append(conns, c)
	}
	return conns, nil
}

func (r *ConnectionRepo) GetByID(id string) (*connection.Connection, error) {
	var c connection.Connection
	err := r.db.QueryRow(`SELECT id, name, db_type, host, port, username, password, ssl_mode, created_at, updated_at FROM connections WHERE id = $1`, id).
		Scan(&c.ID, &c.Name, &c.DBType, &c.Host, &c.Port, &c.Username, &c.Password, &c.SSLMode, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get connection %s: %w", id, err)
	}
	return &c, nil
}

func (r *ConnectionRepo) Create(c *connection.Connection) error {
	c.ID = uuid.New().String()
	c.CreatedAt = time.Now()
	c.UpdatedAt = c.CreatedAt

	_, err := r.db.Exec(`INSERT INTO connections (id, name, db_type, host, port, username, password, ssl_mode, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		c.ID, c.Name, c.DBType, c.Host, c.Port, c.Username, c.Password, c.SSLMode, c.CreatedAt, c.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create connection: %w", err)
	}
	return nil
}

func (r *ConnectionRepo) Update(c *connection.Connection) error {
	c.UpdatedAt = time.Now()
	_, err := r.db.Exec(`UPDATE connections SET name=$1, host=$2, port=$3, username=$4, password=$5, ssl_mode=$6, updated_at=$7 WHERE id=$8`,
		c.Name, c.Host, c.Port, c.Username, c.Password, c.SSLMode, c.UpdatedAt, c.ID)
	if err != nil {
		return fmt.Errorf("update connection %s: %w", c.ID, err)
	}
	return nil
}

func (r *ConnectionRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM connections WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete connection %s: %w", id, err)
	}
	return nil
}

func (r *ConnectionRepo) ListDatabases(connectionID string) ([]connection.ConnectionDatabase, error) {
	rows, err := r.db.Query(`SELECT id, connection_id, db_name, is_selected, COALESCE(size_bytes, 0), created_at FROM connection_databases WHERE connection_id = $1 ORDER BY db_name`, connectionID)
	if err != nil {
		return nil, fmt.Errorf("list databases: %w", err)
	}
	defer rows.Close()

	var dbs []connection.ConnectionDatabase
	for rows.Next() {
		var db connection.ConnectionDatabase
		if err := rows.Scan(&db.ID, &db.ConnectionID, &db.DBName, &db.IsSelected, &db.SizeBytes, &db.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan database: %w", err)
		}
		dbs = append(dbs, db)
	}
	return dbs, nil
}

func (r *ConnectionRepo) GetDatabase(id string) (*connection.ConnectionDatabase, error) {
	var db connection.ConnectionDatabase
	err := r.db.QueryRow(`SELECT id, connection_id, db_name, is_selected, COALESCE(size_bytes, 0), created_at FROM connection_databases WHERE id = $1`, id).
		Scan(&db.ID, &db.ConnectionID, &db.DBName, &db.IsSelected, &db.SizeBytes, &db.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get database %s: %w", id, err)
	}
	return &db, nil
}

func (r *ConnectionRepo) UpsertDatabases(dbs []connection.ConnectionDatabase) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.Prepare(`INSERT INTO connection_databases (id, connection_id, db_name, is_selected, size_bytes, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(connection_id, db_name) DO UPDATE SET is_selected=EXCLUDED.is_selected, size_bytes=EXCLUDED.size_bytes`)
	if err != nil {
		return fmt.Errorf("prepare upsert: %w", err)
	}
	defer stmt.Close()

	for _, db := range dbs {
		if db.ID == "" {
			db.ID = uuid.New().String()
		}
		if db.CreatedAt.IsZero() {
			db.CreatedAt = time.Now()
		}
		selected := 0
		if db.IsSelected {
			selected = 1
		}
		if _, err := stmt.Exec(db.ID, db.ConnectionID, db.DBName, selected, db.SizeBytes, db.CreatedAt); err != nil {
			return fmt.Errorf("upsert db %s: %w", db.DBName, err)
		}
	}

	return tx.Commit()
}

func (r *ConnectionRepo) UpdateDatabaseSelection(id string, selected bool) error {
	s := 0
	if selected {
		s = 1
	}
	_, err := r.db.Exec(`UPDATE connection_databases SET is_selected = $1 WHERE id = $2`, s, id)
	if err != nil {
		return fmt.Errorf("update db selection %s: %w", id, err)
	}
	return nil
}
