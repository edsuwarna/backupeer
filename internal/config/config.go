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
		Port:              getEnv("BACKUPEER_PORT", "8080"),
		DataDir:           getEnv("BACKUPEER_DATA_DIR", "/data"),
		AdminUser:         getEnv("BACKUPEER_ADMIN_USER", "admin"),
		AdminPass:         getEnv("BACKUPEER_ADMIN_PASS", "admin123"),
		SecretKey:         getEnv("BACKUPEER_SECRET_KEY", "change-me-in-production"),
		EncryptionKey:     getEnv("BACKUPEER_ENCRYPTION_KEY", ""),
		MasterKey:         getEnv("BACKUPEER_MASTER_KEY", ""),
		StorageEndpoint:   getEnv("BACKUPEER_S3_ENDPOINT", ""),
		StorageRegion:     getEnv("BACKUPEER_S3_REGION", "auto"),
		StorageBucket:     getEnv("BACKUPEER_S3_BUCKET", "backups"),
		StorageAccessKey:  getEnv("BACKUPEER_S3_ACCESS_KEY", ""),
		StorageSecretKey:  getEnv("BACKUPEER_S3_SECRET_KEY", ""),
		StoragePathStyle:  getEnv("BACKUPEER_S3_PATH_STYLE", "true") == "true",
		MaxConcurrent:     getEnvInt("BACKUPEER_MAX_CONCURRENT", 3),
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
