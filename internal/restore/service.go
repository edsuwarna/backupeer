package restore

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"time"

	"github.com/edsuwarna/backupeer/internal/backup"
	"github.com/edsuwarna/backupeer/internal/connection"
	"github.com/edsuwarna/backupeer/internal/encryption"
	"github.com/edsuwarna/backupeer/internal/httputil"
	"github.com/edsuwarna/backupeer/internal/storage"
)

// ProviderService interface for looking up storage providers.
type ProviderService interface {
	GetDecrypted(id string) (*storage.Provider, error)
	GetDefault() (*storage.Provider, error)
	CreateS3ClientFromProvider(p *storage.Provider) (*storage.S3Client, error)
}

type Service struct {
	repo      Repository
	backupRepo backup.Repository
	connRepo   connection.Repository
	provSvc    ProviderService
	encSvc     encryption.Service
}

func NewService(repo Repository, backupRepo backup.Repository, connRepo connection.Repository, provSvc ProviderService) *Service {
	return &Service{
		repo:       repo,
		backupRepo: backupRepo,
		connRepo:   connRepo,
		provSvc:    provSvc,
	}
}

// SetEncryptionService sets the optional encryption service.
func (s *Service) SetEncryptionService(encSvc encryption.Service) {
	s.encSvc = encSvc
}

func (s *Service) List() ([]Restore, error) {
	return s.repo.List()
}

func (s *Service) Get(id string) (*Restore, error) {
	return s.repo.GetByID(id)
}

func (s *Service) StartRestore(backupID, targetConnectionID string) (*Restore, error) {
	b, err := s.backupRepo.GetByID(backupID)
	if err != nil {
		return nil, fmt.Errorf("get backup: %w", err)
	}
	if b == nil {
		return nil, fmt.Errorf("backup not found")
	}
	if b.Status != "success" {
		return nil, fmt.Errorf("cannot restore backup with status: %s", b.Status)
	}

	// Determine target connection: either original or specified
	connID := b.ConnectionID
	if targetConnectionID != "" {
		connID = targetConnectionID
	}

	conn, err := s.connRepo.GetByID(connID)
	if err != nil {
		return nil, fmt.Errorf("get target connection: %w", err)
	}
	if conn == nil {
		return nil, fmt.Errorf("target connection not found")
	}

	res := &Restore{
		BackupID: backupID,
		Status:   "running",
	}
	if targetConnectionID != "" {
		res.TargetConnection = &targetConnectionID
	}

	if err := s.repo.Create(res); err != nil {
		return nil, fmt.Errorf("create restore record: %w", err)
	}

	// Execute restore asynchronously
	go s.runRestore(res, b, conn)

	return res, nil
}

func (s *Service) runRestore(r *Restore, b *backup.Backup, conn *connection.Connection) {
	startTime := time.Now()
	r.StartedAt = &startTime

	var logBuf bytes.Buffer

	// Resolve storage provider
	prov, err := s.resolveProvider(b.StorageProviderID)
	if err != nil {
		logBuf.WriteString(fmt.Sprintf("STORAGE PROVIDER ERROR: %v\n", err))
		s.failRestore(r, logBuf.String())
		return
	}

	storageSvc, err := s.provSvc.CreateS3ClientFromProvider(prov)
	if err != nil {
		logBuf.WriteString(fmt.Sprintf("STORAGE CLIENT ERROR: %v\n", err))
		s.failRestore(r, logBuf.String())
		return
	}

	// 1. Download from S3
	ctx := context.Background()
	var dataBuf bytes.Buffer
	if err := storageSvc.Download(ctx, b.StoragePath, &dataBuf); err != nil {
		logBuf.WriteString(fmt.Sprintf("DOWNLOAD ERROR: %v\n", err))
		s.failRestore(r, logBuf.String())
		return
	}
	logBuf.WriteString(fmt.Sprintf("DOWNLOAD: %s (%d bytes)\n", b.StoragePath, dataBuf.Len()))

	data := dataBuf.Bytes()

	// 2. Optional decrypt
	if s.encSvc != nil && b.EncryptedSizeBytes != nil && *b.EncryptedSizeBytes > 0 {
		decrypted, err := s.encSvc.Decrypt(data, "default")
		if err != nil {
			logBuf.WriteString(fmt.Sprintf("DECRYPT ERROR: %v\n", err))
			s.failRestore(r, logBuf.String())
			return
		}
		data = decrypted
		logBuf.WriteString("DECRYPT: OK (AES-256-GCM)\n")
	}

	// 3. Decompress
	decompressed, err := decompressData(data)
	if err != nil {
		logBuf.WriteString(fmt.Sprintf("DECOMPRESS ERROR: %v\n", err))
		s.failRestore(r, logBuf.String())
		return
	}
	logBuf.WriteString(fmt.Sprintf("DECOMPRESS: %d -> %d bytes\n", len(data), len(decompressed)))

	// 4. Restore to target database
	if err := s.executeRestore(conn, decompressed); err != nil {
		logBuf.WriteString(fmt.Sprintf("RESTORE ERROR: %v\n", err))
		s.failRestore(r, logBuf.String())
		return
	}
	logBuf.WriteString("RESTORE: OK\n")

	// Success
	now := time.Now()
	duration := now.Sub(startTime).Milliseconds()
	r.DurationMs = &duration
	r.CompletedAt = &now
	r.Status = "success"
	r.LogOutput = logBuf.String()

	if err := s.repo.Update(r); err != nil {
		fmt.Printf("ERROR updating restore %s: %v\n", r.ID, err)
	}
}

// resolveProvider finds the storage provider for a backup.
func (s *Service) resolveProvider(providerID *string) (*storage.Provider, error) {
	if providerID != nil && *providerID != "" {
		prov, err := s.provSvc.GetDecrypted(*providerID)
		if err != nil {
			return nil, fmt.Errorf("get storage provider %s: %w", *providerID, err)
		}
		if prov != nil {
			return prov, nil
		}
	}

	// Fall back to default
	prov, err := s.provSvc.GetDefault()
	if err != nil {
		return nil, fmt.Errorf("get default provider: %w", err)
	}
	if prov == nil {
		return nil, fmt.Errorf("no storage provider configured")
	}
	return prov, nil
}

func (s *Service) executeRestore(conn *connection.Connection, data []byte) error {
	switch conn.DBType {
	case "postgresql":
		return s.pgRestore(conn, data)
	case "mysql", "mariadb":
		return s.mySQLRestore(conn, data)
	default:
		return fmt.Errorf("unsupported database type: %s", conn.DBType)
	}
}

func (s *Service) pgRestore(conn *connection.Connection, data []byte) error {
	args := []string{
		"-h", conn.Host,
		"-p", fmt.Sprintf("%d", conn.Port),
		"-U", conn.Username,
		"--clean",
		"--if-exists",
		"--dbname", "postgres",
	}

	cmd := exec.Command("pg_restore", args...)
	cmd.Env = append(cmd.Environ(), fmt.Sprintf("PGPASSWORD=%s", conn.Password))
	cmd.Stdin = bytes.NewReader(data)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pg_restore: %w\nstderr: %s", err, stderr.String())
	}

	return nil
}

func (s *Service) mySQLRestore(conn *connection.Connection, data []byte) error {
	dumpTool := "mysql"
	if conn.DBType == "mariadb" {
		if _, err := exec.LookPath("mariadb"); err == nil {
			dumpTool = "mariadb"
		}
	}

	args := []string{
		"-h", conn.Host,
		"-P", fmt.Sprintf("%d", conn.Port),
		"-u", conn.Username,
		fmt.Sprintf("--password=%s", conn.Password),
	}

	cmd := exec.Command(dumpTool, args...)
	cmd.Stdin = bytes.NewReader(data)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s restore: %w\nstderr: %s", dumpTool, err, stderr.String())
	}

	return nil
}

func (s *Service) failRestore(r *Restore, logOutput string) {
	now := time.Now()
	r.CompletedAt = &now
	r.Status = "failed"
	r.LogOutput = logOutput
	if err := s.repo.Update(r); err != nil {
		fmt.Printf("ERROR updating failed restore %s: %v\n", r.ID, err)
	}
}

func decompressData(data []byte) ([]byte, error) {
	gr, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create gzip reader: %w", err)
	}
	defer gr.Close()

	var buf bytes.Buffer
	if _, err := buf.ReadFrom(gr); err != nil {
		return nil, fmt.Errorf("decompress: %w", err)
	}
	return buf.Bytes(), nil
}

// Handler handles HTTP requests for restore operations.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/restores", h.handleList)
	mux.HandleFunc("POST /api/backups/{id}/restore", h.handleRestore)
	mux.HandleFunc("GET /api/restores/{id}", h.handleGet)
}

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request) {
	restores, err := h.svc.List()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, restores)
}

func (h *Handler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	res, err := h.svc.Get(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if res == nil {
		httputil.WriteError(w, http.StatusNotFound, "restore not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleRestore(w http.ResponseWriter, r *http.Request) {
	backupID := r.PathValue("id")
	var req struct {
		TargetConnection string `json:"target_connection,omitempty"`
	}
	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	res, err := h.svc.StartRestore(backupID, req.TargetConnection)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, res)
}
