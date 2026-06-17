package postgres

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/edsuwarna/jagad/internal/storage"
	"github.com/google/uuid"
)

// StorageProviderRepo implements storage.ProviderRepository using PostgreSQL.
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
		created_at, updated_at FROM storage_providers WHERE id = $1`, id))
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
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		p.ID, p.Name, p.ProviderType, p.Endpoint, p.Region, p.Bucket,
		[]byte(p.AccessKey), []byte(p.SecretKey),
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
		name=$1, provider_type=$2, endpoint=$3, region=$4, bucket=$5,
		access_key_encrypted=$6, secret_key_encrypted=$7, path_style=$8, is_default=$9, updated_at=$10
		WHERE id=$11`,
		p.Name, p.ProviderType, p.Endpoint, p.Region, p.Bucket,
		[]byte(p.AccessKey), []byte(p.SecretKey),
		pathStyle, isDefault, p.UpdatedAt, p.ID)
	if err != nil {
		return fmt.Errorf("update provider %s: %w", p.ID, err)
	}
	return nil
}

func (r *StorageProviderRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM storage_providers WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete provider %s: %w", id, err)
	}
	return nil
}

func (r *StorageProviderRepo) ClearDefault(excludeID string) error {
	_, err := r.db.Exec(`UPDATE storage_providers SET is_default = 0 WHERE id != $1`, excludeID)
	if err != nil {
		return fmt.Errorf("clear default: %w", err)
	}
	return nil
}

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
