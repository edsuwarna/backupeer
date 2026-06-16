// Package storage provides storage abstractions and provider management.
package storage

import "time"

// ProviderType enum for S3-compatible providers.
const (
	ProviderS3       = "s3"
	ProviderR2       = "r2"
	ProviderMinIO    = "minio"
	ProviderGCS      = "gcs"
	ProviderB2       = "b2"
	ProviderS3Compat = "s3-compat"
)

// Provider represents a storage provider configuration (S3/R2/MinIO).
type Provider struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	ProviderType    string    `json:"provider_type"` // s3, r2, minio, gcs, b2, s3-compat
	Endpoint        string    `json:"endpoint"`
	Region          string    `json:"region"`
	Bucket          string    `json:"bucket"`
	AccessKey       string    `json:"access_key,omitempty"`  // plaintext only in API responses during create
	SecretKey       string    `json:"secret_key,omitempty"`  // plaintext only in API responses during create
	PathStyle       bool      `json:"path_style"`
	IsDefault       bool      `json:"is_default"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ProviderRepository defines persistence contract for storage providers.
type ProviderRepository interface {
	List() ([]Provider, error)
	GetByID(id string) (*Provider, error)
	GetDefault() (*Provider, error)
	Create(p *Provider) error
	Update(p *Provider) error
	Delete(id string) error
	ClearDefault(excludeID string) error
}
