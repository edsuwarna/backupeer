package storage

import (
	"context"
	"fmt"
)

// ProviderService handles storage provider CRUD with credential encryption.
type ProviderService struct {
	repo     ProviderRepository
	encryptor *CredentialEncryptor
}

// NewProviderService creates a new provider service.
func NewProviderService(repo ProviderRepository, masterKey string) *ProviderService {
	return &ProviderService{
		repo:      repo,
		encryptor: NewCredentialEncryptor(masterKey),
	}
}

// List returns all storage providers (with masked credentials).
func (s *ProviderService) List() ([]Provider, error) {
	ps, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	// Decrypt credentials for API response
	for i := range ps {
		ps[i].AccessKey = string(s.encryptor.MustDecrypt([]byte(ps[i].AccessKey)))
		ps[i].SecretKey = "••••••" // mask secret key
	}
	return ps, nil
}

// GetByID returns a provider by ID with decrypted credentials.
func (s *ProviderService) GetByID(id string) (*Provider, error) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, nil
	}
	// Decrypt
	decAK := s.encryptor.MustDecrypt([]byte(p.AccessKey))
	s.encryptor.MustDecrypt([]byte(p.SecretKey)) // decrypt but don't expose in API
	p.AccessKey = string(decAK)
	p.SecretKey = "••••••"
	return p, nil
}

// GetDecrypted returns a provider with raw (decrypted) credentials — for internal use.
func (s *ProviderService) GetDecrypted(id string) (*Provider, error) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, nil
	}
	p.AccessKey = string(s.encryptor.MustDecrypt([]byte(p.AccessKey)))
	p.SecretKey = string(s.encryptor.MustDecrypt([]byte(p.SecretKey)))
	return p, nil
}

// GetDefault returns the default provider (with credentials masked).
func (s *ProviderService) GetDefault() (*Provider, error) {
	p, err := s.repo.GetDefault()
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, nil
	}
	p.AccessKey = string(s.encryptor.MustDecrypt([]byte(p.AccessKey)))
	p.SecretKey = "••••••"
	return p, nil
}

// Create creates a new storage provider.
func (s *ProviderService) Create(p *Provider) error {
	if p.Name == "" {
		return fmt.Errorf("provider name is required")
	}
	if p.Endpoint == "" {
		return fmt.Errorf("endpoint is required")
	}
	if p.Bucket == "" {
		return fmt.Errorf("bucket is required")
	}
	if p.ProviderType == "" {
		p.ProviderType = ProviderS3
	}
	if p.Region == "" {
		p.Region = "auto"
	}

	// Encrypt credentials before storing
	p.AccessKey = string(s.encryptor.MustEncrypt([]byte(p.AccessKey)))
	p.SecretKey = string(s.encryptor.MustEncrypt([]byte(p.SecretKey)))

	// If this is the first provider, make it default
	if p.IsDefault {
		if err := s.repo.ClearDefault(""); err != nil {
			return err
		}
	}

	return s.repo.Create(p)
}

// Update updates an existing storage provider.
func (s *ProviderService) Update(p *Provider) error {
	existing, err := s.repo.GetByID(p.ID)
	if err != nil {
		return err
	}
	if existing == nil {
		return fmt.Errorf("provider not found")
	}

	// If access_key is masked, keep existing
	if p.AccessKey == "••••••" || p.AccessKey == "" {
		p.AccessKey = existing.AccessKey
	} else {
		p.AccessKey = string(s.encryptor.MustEncrypt([]byte(p.AccessKey)))
	}

	// If secret_key is masked, keep existing
	if p.SecretKey == "••••••" || p.SecretKey == "" {
		p.SecretKey = existing.SecretKey
	} else {
		p.SecretKey = string(s.encryptor.MustEncrypt([]byte(p.SecretKey)))
	}

	if p.ProviderType == "" {
		p.ProviderType = existing.ProviderType
	}
	if p.Region == "" {
		p.Region = existing.Region
	}

	if p.IsDefault {
		if err := s.repo.ClearDefault(p.ID); err != nil {
			return err
		}
	}

	return s.repo.Update(p)
}

// Delete removes a storage provider.
func (s *ProviderService) Delete(id string) error {
	return s.repo.Delete(id)
}

// TestConnection tests connectivity to a storage provider.
func (s *ProviderService) TestConnection(ctx context.Context, p *Provider) error {
	// Build S3 client from provider config
	cfg := Config{
		Endpoint:  p.Endpoint,
		Region:    p.Region,
		Bucket:    p.Bucket,
		AccessKey: p.AccessKey,
		SecretKey: p.SecretKey,
		PathStyle: p.PathStyle,
	}
	client, err := NewS3Client(cfg)
	if err != nil {
		return fmt.Errorf("create client: %w", err)
	}

	// Check bucket existence to verify connectivity + permissions
	if err := client.BucketExists(ctx); err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}

	return nil
}

// CreateS3ClientFromProvider creates an S3 client from a provider config.
func (s *ProviderService) CreateS3ClientFromProvider(p *Provider) (*S3Client, error) {
	cfg := Config{
		Endpoint:  p.Endpoint,
		Region:    p.Region,
		Bucket:    p.Bucket,
		AccessKey: p.AccessKey,
		SecretKey: p.SecretKey,
		PathStyle: p.PathStyle,
	}
	return NewS3Client(cfg)
}
