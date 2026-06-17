// Package config provides application configuration loaded from environment variables.
package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration.
type Config struct {
	Port              string
	DataDir           string
	DatabaseURL       string
	AdminUser         string
	AdminPass         string
	SecretKey         string
	EncryptionKey     string
	MasterKey         string
	StorageEndpoint   string
	StorageRegion     string
	StorageBucket     string
	StorageAccessKey  string
	StorageSecretKey  string
	StoragePathStyle  bool
	MaxConcurrent     int
	DBTimeout         time.Duration
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		Port:              getEnv("JAGAD_PORT", "8080"),
		DataDir:           getEnv("JAGAD_DATA_DIR", "/data"),
		DatabaseURL:       getEnv("JAGAD_DATABASE_URL", ""),
		AdminUser:         getEnv("JAGAD_ADMIN_USER", "admin"),
		AdminPass:         getEnv("JAGAD_ADMIN_PASS", "admin123"),
		SecretKey:         getEnv("JAGAD_SECRET_KEY", "change-me-in-production"),
		EncryptionKey:     getEnv("JAGAD_ENCRYPTION_KEY", ""),
		MasterKey:         getEnv("JAGAD_MASTER_KEY", ""),
		StorageEndpoint:   getEnv("JAGAD_S3_ENDPOINT", ""),
		StorageRegion:     getEnv("JAGAD_S3_REGION", "auto"),
		StorageBucket:     getEnv("JAGAD_S3_BUCKET", "backups"),
		StorageAccessKey:  getEnv("JAGAD_S3_ACCESS_KEY", ""),
		StorageSecretKey:  getEnv("JAGAD_S3_SECRET_KEY", ""),
		StoragePathStyle:  getEnv("JAGAD_S3_PATH_STYLE", "true") == "true",
		MaxConcurrent:     getEnvInt("JAGAD_MAX_CONCURRENT", 3),
		DBTimeout:         5 * time.Second,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
