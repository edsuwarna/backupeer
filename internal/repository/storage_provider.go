package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/edsuwarna/backupeer/internal/storage"
	"github.com/google/uuid"
)

// StorageProviderRepo implements storage.ProviderRepository using SQLite.
type StorageProviderRepo struct {
	db *sql.DB
}

func NewStorageProviderRepo(db *sql.DB) *StorageProviderRepo {
	return &StorageProviderRepo{db: db}
}

func (r *StorageProviderRepo) List() ([]storage.Provider, error) {
	rows, err := r.db.Query(`SELECT id, name, provider_type, endpoint, region, bucket,
		access_key_encrypted, secret_key_encrypted, path_style, is_default,
		created_at, updated_at FROM storage_providers ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list providers: %w", err)
	}
	defer rows.Close()

	var ps []storage.Provider
	for rows.Next() {
		p, err := scanProvider(rows)
		if err != nil {
			return nil, err
		}
		ps = append(ps, p)
	}
	return ps, nil
}

func (r *StorageProviderRepo) GetByID(id string) (*storage.Provider, error) {
	p, err := scanProviderRow(r.db.QueryRow(`SELECT id, name, provider_type, endpoint, region, bucket,
		access_key_encrypted, secret_key_encrypted, path_style, is_default,
		created_at, updated_at FROM storage_providers WHERE id = ?`, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get provider %s: %w", id, err)
	}
	return &p, nil
}

func (r *StorageProviderRepo) GetDefault() (*storage.Provider, error) {
	p, err := scanProviderRow(r.db.QueryRow(`SELECT id, name, provider_type, endpoint, region, bucket,
		access_key_encrypted, secret_key_encrypted, path_style, is_default,
		created_at, updated_at FROM storage_providers WHERE is_default = 1 LIMIT 1`))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get default provider: %w", err)
	}
	return &p, nil
}

func (r *StorageProviderRepo) Create(p *storage.Provider) error {
	p.ID = uuid.New().String()
	p.CreatedAt = time.Now()
	p.UpdatedAt = p.CreatedAt

	pathStyle := 0
	if p.PathStyle {
		pathStyle = 1
	}
	isDefault := 0
	if p.IsDefault {
		isDefault = 1
	}

	_, err := r.db.Exec(`INSERT INTO storage_providers
		(id, name, provider_type, endpoint, region, bucket,
		 access_key_encrypted, secret_key_encrypted, path_style, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.ProviderType, p.Endpoint, p.Region, p.Bucket,
		[]byte(p.AccessKey), []byte(p.SecretKey), // stored encrypted by service layer
		pathStyle, isDefault, p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create provider: %w", err)
	}
	return nil
}

func (r *StorageProviderRepo) Update(p *storage.Provider) error {
	p.UpdatedAt = time.Now()

	pathStyle := 0
	if p.PathStyle {
		pathStyle = 1
	}
	isDefault := 0
	if p.IsDefault {
		isDefault = 1
	}

	_, err := r.db.Exec(`UPDATE storage_providers SET
		name=?, provider_type=?, endpoint=?, region=?, bucket=?,
		access_key_encrypted=?, secret_key_encrypted=?, path_style=?, is_default=?, updated_at=?
		WHERE id=?`,
		p.Name, p.ProviderType, p.Endpoint, p.Region, p.Bucket,
		[]byte(p.AccessKey), []byte(p.SecretKey), // stored encrypted
		pathStyle, isDefault, p.UpdatedAt, p.ID)
	if err != nil {
		return fmt.Errorf("update provider %s: %w", p.ID, err)
	}
	return nil
}

func (r *StorageProviderRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM storage_providers WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete provider %s: %w", id, err)
	}
	return nil
}

func (r *StorageProviderRepo) ClearDefault(excludeID string) error {
	_, err := r.db.Exec(`UPDATE storage_providers SET is_default = 0 WHERE id != ?`, excludeID)
	if err != nil {
		return fmt.Errorf("clear default: %w", err)
	}
	return nil
}

// scanProviderRow scans a single row into a Provider.
func scanProviderRow(row *sql.Row) (storage.Provider, error) {
	var p storage.Provider
	var pathStyle, isDefault int
	var accessKeyEnc, secretKeyEnc []byte
	err := row.Scan(&p.ID, &p.Name, &p.ProviderType, &p.Endpoint, &p.Region, &p.Bucket,
		&accessKeyEnc, &secretKeyEnc, &pathStyle, &isDefault,
		&p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return p, err
	}
	p.PathStyle = pathStyle == 1
	p.IsDefault = isDefault == 1
	p.AccessKey = string(accessKeyEnc)
	p.SecretKey = string(secretKeyEnc)
	return p, nil
}

// scanProvider scans from rows iterator.
func scanProvider(rows *sql.Rows) (storage.Provider, error) {
	var p storage.Provider
	var pathStyle, isDefault int
	var accessKeyEnc, secretKeyEnc []byte
	err := rows.Scan(&p.ID, &p.Name, &p.ProviderType, &p.Endpoint, &p.Region, &p.Bucket,
		&accessKeyEnc, &secretKeyEnc, &pathStyle, &isDefault,
		&p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return p, fmt.Errorf("scan provider: %w", err)
	}
	p.PathStyle = pathStyle == 1
	p.IsDefault = isDefault == 1
	p.AccessKey = string(accessKeyEnc)
	p.SecretKey = string(secretKeyEnc)
	return p, nil
}
