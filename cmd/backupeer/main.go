// Backupeer — Database backup management tool.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"

	"github.com/edsuwarna/backupeer/internal/api"
	"github.com/edsuwarna/backupeer/internal/auth"
	backupsvc "github.com/edsuwarna/backupeer/internal/backup"
	"github.com/edsuwarna/backupeer/internal/config"
	connsvc "github.com/edsuwarna/backupeer/internal/connection"
	"github.com/edsuwarna/backupeer/internal/encryption"
	notifsvc "github.com/edsuwarna/backupeer/internal/notification"
	"github.com/edsuwarna/backupeer/internal/repository"
	restsvc "github.com/edsuwarna/backupeer/internal/restore"
	schsvc "github.com/edsuwarna/backupeer/internal/schedule"
	"github.com/edsuwarna/backupeer/internal/storage"
)

var Version = "dev"

func main() {
	cfg := config.Load()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
	slog.Info("starting backupeer", "version", Version)

	// Initialize SQLite
	db, err := repository.Open(cfg.DataDir, 5)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Initialize repositories
	connRepo := repository.NewConnectionRepo(db)
	backupRepo := repository.NewBackupRepo(db)
	scheduleRepo := repository.NewScheduleRepo(db)
	restoreRepo := repository.NewRestoreRepo(db)
	storageProvRepo := repository.NewStorageProviderRepo(db)

	// Initialize storage provider service (manages S3/R2 config from UI)
	provSvc := storage.NewProviderService(storageProvRepo, cfg.MasterKey)

	// Initialize encryption (optional — for backup data encryption)
	var encSvc encryption.Service
	if cfg.EncryptionKey != "" {
		encSvc = encryption.NewAESGCMService([]byte(cfg.EncryptionKey))
		slog.Info("encryption enabled (AES-256-GCM)")
	}

	// Also try to create the legacy env-based storage client for backward compat
	var legacyStorageErr error
	if cfg.StorageEndpoint != "" && cfg.StorageAccessKey != "" {
		storageCfg := storage.Config{
			Endpoint:  cfg.StorageEndpoint,
			Region:    cfg.StorageRegion,
			Bucket:    cfg.StorageBucket,
			AccessKey: cfg.StorageAccessKey,
			SecretKey: cfg.StorageSecretKey,
			PathStyle: cfg.StoragePathStyle,
		}
		_, legacyStorageErr = storage.NewS3Client(storageCfg)
		if legacyStorageErr == nil {
			slog.Info("legacy env-based storage configured — consider migrating to UI-based storage")
		}
	}

	// Check for required tools
	checkRequiredTools()

	// Initialize services
	backupSvc := backupsvc.NewService(backupRepo, connRepo, provSvc)
	if encSvc != nil {
		backupSvc.SetEncryptionService(encSvc)
	}

	connSvc := connsvc.NewService(connRepo)
	scheduleSvc := schsvc.NewService(scheduleRepo, connRepo)
	restoreSvc := restsvc.NewService(restoreRepo, backupRepo, connRepo, provSvc)
	if encSvc != nil {
		restoreSvc.SetEncryptionService(encSvc)
	}

	// Initialize scheduler
	scheduler := schsvc.NewScheduler(scheduleRepo, connRepo, backupSvc)
	if err := scheduler.Start(); err != nil {
		slog.Warn("scheduler start", "error", err)
	}
	slog.Info("scheduler started", "active", scheduler.ActiveEntries())

	// Initialize storage provider handler
	storageProvHandler := storage.NewProviderHandler(provSvc)

	// Initialize notification service
	notifRepo := repository.NewNotificationRepo(db)
	notifSvc := notifsvc.NewService(notifRepo)
	notifHandler := notifsvc.NewHandler(notifSvc)

	// Wire notifications into backup service
	backupSvc.SetNotifier(notifSvc)

	// Initialize handlers
	connHandler := connsvc.NewHandler(connSvc)
	backupHandler := backupsvc.NewHandler(backupSvc)
	scheduleHandler := schsvc.NewHandler(scheduleSvc, scheduler)
	restoreHandler := restsvc.NewHandler(restoreSvc)

	// Initialize auth
	authSvc := auth.NewService(cfg.AdminUser, cfg.AdminPass, cfg.SecretKey)

	// Build api router (protected routes)
	apiRouter := api.NewRouter(connHandler, backupHandler, scheduleHandler, restoreHandler, storageProvHandler, notifHandler)
	protected := authSvc.Middleware(apiRouter.Handler())

	// Top-level mux
	mux := http.NewServeMux()

	// Auth endpoints (public)
	mux.HandleFunc("POST /api/auth/login", authSvc.HandleLogin)
	mux.HandleFunc("POST /api/auth/logout", authSvc.HandleLogout)
	mux.HandleFunc("GET /api/auth/check", authSvc.HandleCheck)

	// Health (public)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		health := map[string]interface{}{
			"status":         "ok",
			"version":        Version,
			"encryption":     encSvc != nil,
			"providers":      true,
			"legacy_storage": legacyStorageErr == nil,
		}
		json.NewEncoder(w).Encode(health)
	})

	// Protected API routes
	mux.Handle("/api/", protected)

	// Apply CORS middleware
	handler := api.Middleware(mux)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	server := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		slog.Info("shutting down gracefully...")

		scheduler.Stop()

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			slog.Error("server shutdown error", "error", err)
		}
	}()

	slog.Info("server listening", "addr", addr)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}

func checkRequiredTools() {
	tools := []struct {
		name string
		cmds []string
	}{
		{"PostgreSQL", []string{"pg_dump", "pg_restore"}},
		{"MySQL", []string{"mysqldump", "mysql"}},
		{"MariaDB", []string{"mariadb-dump", "mariadb", "mysqldump", "mysql"}},
	}

	for _, t := range tools {
		found := false
		for _, cmd := range t.cmds {
			if _, err := exec.LookPath(cmd); err == nil {
				found = true
				break
			}
		}
		if !found {
			slog.Warn(fmt.Sprintf("%s tools not found in PATH", t.name))
		}
	}
}
