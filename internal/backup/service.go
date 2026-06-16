package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os/exec"
	"time"

	"github.com/edsuwarna/backupeer/internal/connection"
	"github.com/edsuwarna/backupeer/internal/encryption"
	"github.com/edsuwarna/backupeer/internal/storage"
)

// ProviderService interface for looking up storage providers.
type ProviderService interface {
	GetDecrypted(id string) (*storage.Provider, error)
	GetDefault() (*storage.Provider, error)
	CreateS3ClientFromProvider(p *storage.Provider) (*storage.S3Client, error)
}

// Notifier interface for sending notifications after backup.
type Notifier interface {
	NotifyBackupResult(backupID, dbName, dbType, status string, sizeBytes int64, durationMs int64, logTail string)
}

// Service handles backup execution and management.
type Service struct {
	repo       Repository
	connRepo   connection.Repository
	provSvc    ProviderService
	encSvc     encryption.Service
	notifier   Notifier
	semaphore  chan struct{} // concurrent backup limiter (max 3)
}

// NewService creates a new backup service.
func NewService(repo Repository, connRepo connection.Repository, provSvc ProviderService) *Service {
	return &Service{
		repo:      repo,
		connRepo:  connRepo,
		provSvc:   provSvc,
		semaphore: make(chan struct{}, 3),
	}
}

// SetEncryptionService sets the optional encryption service.
func (s *Service) SetEncryptionService(encSvc encryption.Service) {
	s.encSvc = encSvc
}

// SetNotifier sets the optional notification service.
func (s *Service) SetNotifier(n Notifier) {
	s.notifier = n
}

// StartBackup initiates a backup operation for the given database.
func (s *Service) StartBackup(connectionID, databaseID, backupType string, scheduleID *string, storageProviderID *string) (*Backup, error) {
	conn, err := s.connRepo.GetByID(connectionID)
	if err != nil {
		return nil, fmt.Errorf("get connection: %w", err)
	}
	if conn == nil {
		return nil, fmt.Errorf("connection not found")
	}

	db, err := s.connRepo.GetDatabase(databaseID)
	if err != nil {
		return nil, fmt.Errorf("get database: %w", err)
	}
	if db == nil {
		return nil, fmt.Errorf("database not found")
	}

	b := &Backup{
		ConnectionID:      connectionID,
		DatabaseID:        databaseID,
		ScheduleID:        scheduleID,
		BackupType:        backupType,
		Status:            "running",
		VerifyStatus:      "pending",
		StorageProviderID: storageProviderID,
	}

	if err := s.repo.Create(b); err != nil {
		return nil, fmt.Errorf("create backup record: %w", err)
	}

	// Execute backup asynchronously
	go s.runBackup(b, conn, db)

	return b, nil
}

func (s *Service) runBackup(b *Backup, conn *connection.Connection, db *connection.ConnectionDatabase) {
	// Acquire semaphore slot (block if already 3 concurrent backups)
	s.semaphore <- struct{}{}
	defer func() { <-s.semaphore }()

	startTime := time.Now()
	b.StartedAt = &startTime

	// Determine storage provider
	prov, err := s.resolveProvider(b.StorageProviderID)
	if err != nil {
		s.failBackup(b, fmt.Sprintf("STORAGE PROVIDER ERROR: %v\n", err))
		return
	}

	// Create storage client
	storageSvc, err := s.provSvc.CreateS3ClientFromProvider(prov)
	if err != nil {
		s.failBackup(b, fmt.Sprintf("STORAGE CLIENT ERROR: %v\n", err))
		return
	}

	// Build storage path
	suffix := "sql.gz"
	key := fmt.Sprintf("backups/%s/%s/%s-%s.%s",
		conn.Name, db.DBName, b.ID, startTime.Format("20060102-150405"), suffix)
	b.StoragePath = key

	// Build log buffer
	var logBuf bytes.Buffer

	// 1. Execute dump
	dumpOutput, dumpErr := s.executeDump(conn, db.DBName, b.BackupType)
	if dumpErr != nil {
		logBuf.WriteString(fmt.Sprintf("DUMP ERROR: %v\n", dumpErr))
		s.failBackup(b, logBuf.String())
		return
	}
	logBuf.WriteString(fmt.Sprintf("DUMP: %d bytes from %s\n", len(dumpOutput), conn.DBType))

	// 2. Compress with gzip
	compressed := compressData(dumpOutput)
	logBuf.WriteString(fmt.Sprintf("COMPRESS: %d -> %d bytes (%.1f%%)\n",
		len(dumpOutput), len(compressed),
		float64(len(compressed))/float64(len(dumpOutput))*100))

	b.SizeBytes = ptr(int64(len(dumpOutput)))

	// 3. Optional encrypt
	finalData := compressed
	if s.encSvc != nil {
		encrypted, err := s.encSvc.Encrypt(compressed, "default")
		if err != nil {
			logBuf.WriteString(fmt.Sprintf("ENCRYPT ERROR: %v\n", err))
			s.failBackup(b, logBuf.String())
			return
		}
		finalData = encrypted
		b.EncryptedSizeBytes = ptr(int64(len(encrypted)))
		logBuf.WriteString(fmt.Sprintf("ENCRYPT: %d bytes (AES-256-GCM)\n", len(encrypted)))
	}

	// 4. Upload to S3 with retry
	ctx := context.Background()
	var uploadErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<(attempt-1)) * time.Second
			logBuf.WriteString(fmt.Sprintf("UPLOAD: retrying in %v (attempt %d/3)\n", backoff, attempt+1))
			time.Sleep(backoff)
		}
		reader := bytes.NewReader(finalData)
		uploadErr = storageSvc.Upload(ctx, key, reader, int64(len(finalData)))
		if uploadErr == nil {
			break
		}
	}
	if uploadErr != nil {
		logBuf.WriteString(fmt.Sprintf("UPLOAD ERROR (after 3 attempts): %v\n", uploadErr))
		s.failBackup(b, logBuf.String())
		return
	}
	logBuf.WriteString(fmt.Sprintf("UPLOAD: %s (%d bytes)\n", key, len(finalData)))

	// 5. Calculate checksum
	if s.encSvc != nil {
		b.Checksum = s.encSvc.Checksum(compressed)
		b.EncryptedChecksum = s.encSvc.Checksum(finalData)
	}

	// Success
	now := time.Now()
	duration := now.Sub(startTime).Milliseconds()
	b.DurationMs = &duration
	b.CompletedAt = &now
	b.Status = "success"
	b.LogOutput = logBuf.String()
	b.StorageProviderID = &prov.ID

	if err := s.repo.Update(b); err != nil {
		fmt.Printf("ERROR updating backup %s: %v\n", b.ID, err)
	}

	// Notify success
	if s.notifier != nil {
		dbName := ""
		if db != nil {
			dbName = db.DBName
		}
		s.notifier.NotifyBackupResult(b.ID, dbName, conn.DBType, "success",
			int64PtrToInt64(b.SizeBytes), int64PtrToInt64(b.DurationMs), b.LogOutput)
	}
}

// resolveProvider finds the storage provider to use for this backup.
func (s *Service) resolveProvider(providerID *string) (*storage.Provider, error) {
	if providerID != nil && *providerID != "" {
		prov, err := s.provSvc.GetDecrypted(*providerID)
		if err != nil {
			return nil, fmt.Errorf("get storage provider %s: %w", *providerID, err)
		}
		if prov == nil {
			return nil, fmt.Errorf("storage provider %s not found", *providerID)
		}
		return prov, nil
	}

	// Fall back to default provider
	prov, err := s.provSvc.GetDefault()
	if err != nil {
		return nil, fmt.Errorf("get default provider: %w", err)
	}
	if prov == nil {
		return nil, fmt.Errorf("no storage provider configured — add one in Settings > Storage")
	}
	return prov, nil
}

// executeDump runs the appropriate dump command for the database type.
func (s *Service) executeDump(conn *connection.Connection, dbName, backupType string) ([]byte, error) {
	switch conn.DBType {
	case "postgresql":
		return s.pgDump(conn, dbName)
	case "mysql", "mariadb":
		return s.mySQLDump(conn, dbName, backupType)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", conn.DBType)
	}
}

func (s *Service) pgDump(conn *connection.Connection, dbName string) ([]byte, error) {
	args := []string{
		"-h", conn.Host,
		"-p", fmt.Sprintf("%d", conn.Port),
		"-U", conn.Username,
		"-d", dbName,
		"--no-password",
		"--clean",
		"--if-exists",
		"--format=c",
	}

	cmd := exec.Command("pg_dump", args...)
	cmd.Env = append(cmd.Environ(), fmt.Sprintf("PGPASSWORD=%s", conn.Password))

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("pg_dump: %w\nstderr: %s", err, stderr.String())
	}

	return stdout.Bytes(), nil
}

func (s *Service) mySQLDump(conn *connection.Connection, dbName, backupType string) ([]byte, error) {
	dumpTool := "mysqldump"
	if conn.DBType == "mariadb" {
		if _, err := exec.LookPath("mariadb-dump"); err == nil {
			dumpTool = "mariadb-dump"
		}
	}

	args := []string{
		"-h", conn.Host,
		"-P", fmt.Sprintf("%d", conn.Port),
		"-u", conn.Username,
		fmt.Sprintf("--password=%s", conn.Password),
		"--single-transaction",
		"--routines",
		"--triggers",
		"--events",
		dbName,
	}

	cmd := exec.Command(dumpTool, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("%s: %w\nstderr: %s", dumpTool, err, stderr.String())
	}

	return stdout.Bytes(), nil
}

func (s *Service) failBackup(b *Backup, logOutput string) {
	now := time.Now()
	b.CompletedAt = &now
	b.Status = "failed"
	b.LogOutput = logOutput
	if err := s.repo.Update(b); err != nil {
		fmt.Printf("ERROR updating failed backup %s: %v\n", b.ID, err)
	}

	// Notify failure
	if s.notifier != nil {
		dbName := ""
		connDBType := ""
		if b.ConnectionID != "" {
			conn, err := s.connRepo.GetByID(b.ConnectionID)
			if err == nil && conn != nil {
				connDBType = conn.DBType
			}
		}
		if b.DatabaseID != "" {
			db, err := s.connRepo.GetDatabase(b.DatabaseID)
			if err == nil && db != nil {
				dbName = db.DBName
			}
		}
		s.notifier.NotifyBackupResult(b.ID, dbName, connDBType, "failed",
			int64PtrToInt64(b.SizeBytes), int64PtrToInt64(b.DurationMs), logOutput)
	}
}

// List returns backups with optional filters.
func (s *Service) List(connectionID, databaseID string, limit, offset int) ([]Backup, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.List(connectionID, databaseID, limit, offset)
}

// Get returns a single backup by ID.
func (s *Service) Get(id string) (*Backup, error) {
	return s.repo.GetByID(id)
}

// Delete removes a backup record (and optionally the stored file).
func (s *Service) Delete(id string) error {
	b, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if b == nil {
		return fmt.Errorf("backup not found")
	}

	// Try to delete from storage
	if b.StorageProviderID != nil && *b.StorageProviderID != "" {
		prov, err := s.provSvc.GetDecrypted(*b.StorageProviderID)
		if err == nil && prov != nil {
			storageSvc, err := s.provSvc.CreateS3ClientFromProvider(prov)
			if err == nil {
				ctx := context.Background()
				if err := storageSvc.Delete(ctx, b.StoragePath); err != nil {
					fmt.Printf("WARN: failed to delete storage object %s: %v\n", b.StoragePath, err)
				}
			}
		}
	}

	return s.repo.Delete(id)
}

// Download writes a backup file from object storage to the given writer.
func (s *Service) Download(id string, writer io.Writer) error {
	b, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("get backup: %w", err)
	}
	if b == nil {
		return fmt.Errorf("backup not found")
	}
	if b.StorageProviderID == nil || *b.StorageProviderID == "" {
		return fmt.Errorf("backup has no storage provider")
	}

	prov, err := s.provSvc.GetDecrypted(*b.StorageProviderID)
	if err != nil {
		return fmt.Errorf("get storage provider: %w", err)
	}
	if prov == nil {
		return fmt.Errorf("storage provider not found")
	}

	storageSvc, err := s.provSvc.CreateS3ClientFromProvider(prov)
	if err != nil {
		return fmt.Errorf("create storage client: %w", err)
	}

	ctx := context.Background()
	if err := storageSvc.Download(ctx, b.StoragePath, writer); err != nil {
		return fmt.Errorf("download from storage: %w", err)
	}
	return nil
}

// StatsResponse holds aggregate backup statistics.
type StatsResponse struct {
	TotalBackups  int            `json:"total_backups"`
	TotalSize     int64          `json:"total_size_bytes"`
	ByType        map[string]int `json:"by_type"`
	ByStatus      map[string]int `json:"by_status"`
	SuccessRate   float64        `json:"success_rate"`
}

// Stats returns aggregate backup statistics.
func (s *Service) Stats() (*StatsResponse, error) {
	backups, err := s.repo.List("", "", 10000, 0)
	if err != nil {
		return nil, err
	}

	stats := &StatsResponse{
		ByType:   make(map[string]int),
		ByStatus: make(map[string]int),
	}

	for _, b := range backups {
		stats.TotalBackups++
		stats.ByType[b.BackupType]++
		stats.ByStatus[b.Status]++
		if b.SizeBytes != nil {
			stats.TotalSize += *b.SizeBytes
		}
	}

	if stats.TotalBackups > 0 {
		success := stats.ByStatus["success"]
		stats.SuccessRate = float64(success) / float64(stats.TotalBackups) * 100
	}

	return stats, nil
}

// StartVerification kicks off async backup verification.
func (s *Service) StartVerification(id string) error {
	b, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("get backup: %w", err)
	}
	if b == nil {
		return fmt.Errorf("backup not found")
	}
	if b.Status != "success" {
		return fmt.Errorf("cannot verify backup with status: %s", b.Status)
	}

	// Mark as verifying
	b.VerifyStatus = "verifying"
	b.Status = "verifying"
	if err := s.repo.Update(b); err != nil {
		return fmt.Errorf("update verify status: %w", err)
	}

	go s.runVerification(b)
	return nil
}

func (s *Service) runVerification(b *Backup) {
	var logBuf bytes.Buffer
	logBuf.WriteString(fmt.Sprintf("VERIFY: starting verification for backup %s\n", b.ID))

	// Resolve storage provider
	prov, err := s.resolveProvider(b.StorageProviderID)
	if err != nil {
		logBuf.WriteString(fmt.Sprintf("STORAGE PROVIDER ERROR: %v\n", err))
		s.failVerification(b, logBuf.String())
		return
	}

	storageSvc, err := s.provSvc.CreateS3ClientFromProvider(prov)
	if err != nil {
		logBuf.WriteString(fmt.Sprintf("STORAGE CLIENT ERROR: %v\n", err))
		s.failVerification(b, logBuf.String())
		return
	}

	// 1. Download from S3
	ctx := context.Background()
	var dataBuf bytes.Buffer
	if err := storageSvc.Download(ctx, b.StoragePath, &dataBuf); err != nil {
		logBuf.WriteString(fmt.Sprintf("DOWNLOAD ERROR: %v\n", err))
		s.failVerification(b, logBuf.String())
		return
	}
	logBuf.WriteString(fmt.Sprintf("DOWNLOAD: %s (%d bytes)\n", b.StoragePath, dataBuf.Len()))

	data := dataBuf.Bytes()

	// 2. Decrypt if needed
	var decrypted []byte
	if s.encSvc != nil && b.EncryptedSizeBytes != nil && *b.EncryptedSizeBytes > 0 {
		decrypted, err = s.encSvc.Decrypt(data, "default")
		if err != nil {
			logBuf.WriteString(fmt.Sprintf("DECRYPT ERROR: %v\n", err))
			s.failVerification(b, logBuf.String())
			return
		}
		logBuf.WriteString("DECRYPT: OK\n")
	} else {
		decrypted = data
	}

	// 3. Compute checksum
	hash := sha256.Sum256(decrypted)
	computedChecksum := hex.EncodeToString(hash[:])
	logBuf.WriteString(fmt.Sprintf("CHECKSUM: computed=%s\n", computedChecksum))

	if b.Checksum != "" {
		if computedChecksum == b.Checksum {
			logBuf.WriteString("VERIFY: checksum MATCH — integrity verified\n")
		} else {
			logBuf.WriteString(fmt.Sprintf("VERIFY: checksum MISMATCH — stored=%s, computed=%s\n", b.Checksum, computedChecksum))
			// Mismatch but still mark as passed if stored is empty? No, mark failed
			s.failVerification(b, logBuf.String())
			return
		}
	} else {
		// No stored checksum to compare — save computed one
		b.Checksum = computedChecksum
		logBuf.WriteString("VERIFY: no stored checksum — saved computed checksum\n")
	}

	// Success
	now := time.Now()
	b.VerifiedAt = &now
	b.VerifyStatus = "passed"
	b.Status = "success"
	b.LogOutput = logBuf.String()
	if err := s.repo.Update(b); err != nil {
		fmt.Printf("ERROR updating verified backup %s: %v\n", b.ID, err)
	}
}

func (s *Service) failVerification(b *Backup, logOutput string) {
	now := time.Now()
	b.VerifiedAt = &now
	b.VerifyStatus = "failed"
	b.Status = "failed"
	b.LogOutput = logOutput
	if err := s.repo.Update(b); err != nil {
		fmt.Printf("ERROR updating failed verification %s: %v\n", b.ID, err)
	}
}

// EnforceRetention deletes backups that exceed the retention limits for a given schedule.
func (s *Service) EnforceRetention(scheduleID string, retentionFull, retentionIncr int) {
	// Full backups: keep only the most recent `retentionFull` ones
	if retentionFull > 0 {
		oldFull, err := s.repo.ListOldestByBackupType(scheduleID, "full", retentionFull)
		if err != nil {
			fmt.Printf("ERROR listing old full backups for schedule %s: %v\n", scheduleID, err)
		} else {
			for _, b := range oldFull {
				if err := s.Delete(b.ID); err != nil {
					fmt.Printf("ERROR deleting old full backup %s: %v\n", b.ID, err)
				} else {
					fmt.Printf("RETENTION: deleted old full backup %s (schedule %s)\n", b.ID[:8], scheduleID)
				}
			}
		}
	}

	// Incremental backups: keep only the most recent `retentionIncr` ones
	if retentionIncr > 0 {
		oldIncr, err := s.repo.ListOldestByBackupType(scheduleID, "incremental", retentionIncr)
		if err != nil {
			fmt.Printf("ERROR listing old incr backups for schedule %s: %v\n", scheduleID, err)
		} else {
			for _, b := range oldIncr {
				if err := s.Delete(b.ID); err != nil {
					fmt.Printf("ERROR deleting old incr backup %s: %v\n", b.ID, err)
				} else {
					fmt.Printf("RETENTION: deleted old incr backup %s (schedule %s)\n", b.ID[:8], scheduleID)
				}
			}
		}
	}
}

func compressData(data []byte) []byte {
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	_, _ = gw.Write(data)
	gw.Close()
	return buf.Bytes()
}

func ptr(v int64) *int64 {
	return &v
}

func int64PtrToInt64(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}
