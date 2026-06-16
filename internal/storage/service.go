// Package storage provides S3-compatible object storage abstraction.
package storage

import (
	"context"
	"io"
)

// Config holds S3-compatible storage configuration.
type Config struct {
	Endpoint  string `json:"endpoint"`
	Region    string `json:"region"`
	Bucket    string `json:"bucket"`
	AccessKey string `json:"access_key"`
	SecretKey string `json:"secret_key"`
	PathStyle bool   `json:"path_style"` // true for MinIO/R2, false for AWS
}

// Service defines the interface for object storage operations.
// Implementations: s3 (compatible with AWS S3, Cloudflare R2, MinIO, Backblaze B2).
type Service interface {
	// Upload reads from reader and stores the object.
	Upload(ctx context.Context, key string, reader io.Reader, size int64) error
	// Download writes the object content to writer.
	Download(ctx context.Context, key string, writer io.Writer) error
	// Delete removes an object.
	Delete(ctx context.Context, key string) error
	// List returns object keys with the given prefix.
	List(ctx context.Context, prefix string) ([]string, error)
	// Exists checks if an object exists.
	Exists(ctx context.Context, key string) (bool, error)
}
