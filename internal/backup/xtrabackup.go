package backup

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/edsuwarna/backupeer/internal/connection"
	"github.com/edsuwarna/backupeer/internal/storage"
)

// XtraBackupEngine implements IncrementalEngine for MySQL using Percona XtraBackup.
type XtraBackupEngine struct {
	provSvc ProviderService
}

// NewXtraBackupEngine creates a new XtraBackup engine.
func NewXtraBackupEngine(provSvc ProviderService) *XtraBackupEngine {
	return &XtraBackupEngine{provSvc: provSvc}
}

func (e *XtraBackupEngine) DBType() string { return "mysql" }

func (e *XtraBackupEngine) BackupFull(sch IncrementalSchedule, conn *connection.Connection, backupID string) (map[string]string, error) {
	return e.runXtraBackup(sch, conn, backupID, "")
}

func (e *XtraBackupEngine) BackupIncremental(sch IncrementalSchedule, conn *connection.Connection, backupID string) (map[string]string, error) {
	// Incremental requires to_lsn from the last backup as --incremental-lsn.
	// For now, call BackupIncremental with the LSN from the last full backup
	// by calling through the service layer.
	return nil, fmt.Errorf("xtrabackup incremental requires --incremental-lsn; use runXtraBackup directly with lastLSN")
}

// runXtraBackup performs a full or incremental backup using XtraBackup.
// For incremental, provide lastLSN from the previous backup's to_lsn metadata.
func (e *XtraBackupEngine) runXtraBackup(sch IncrementalSchedule, conn *connection.Connection, backupID string, lastLSN string) (map[string]string, error) {
	// Resolve storage provider
	prov, err := e.provSvc.GetDecrypted(sch.StorageProviderID)
	if err != nil {
		return nil, fmt.Errorf("get storage provider: %w", err)
	}
	if prov == nil {
		return nil, fmt.Errorf("storage provider %s not found", sch.StorageProviderID)
	}

	// Create temp directory for backup output
	tmpDir := filepath.Join(os.TempDir(), "backupeer", "xtrabackup", backupID)
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return nil, fmt.Errorf("create tmp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	targetDir := filepath.Join(tmpDir, "data")
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return nil, fmt.Errorf("create target dir: %w", err)
	}

	// Build xtrabackup command
	args := []string{
		"--backup",
		"--target-dir=" + targetDir,
		"--host=" + conn.Host,
		"--port=" + fmt.Sprintf("%d", conn.Port),
		"--user=" + conn.Username,
		"--password=" + conn.Password,
		"--parallel=4",
	}

	if lastLSN != "" {
		args = append(args, "--incremental-lsn="+lastLSN)
	}

	xtraCmd := exec.Command("xtrabackup", args...)
	var xtraOut, xtraErr bytes.Buffer
	xtraCmd.Stdout = &xtraOut
	xtraCmd.Stderr = &xtraErr

	if err := xtraCmd.Run(); err != nil {
		return nil, fmt.Errorf("xtrabackup failed: %w\noutput: %s", err, xtraErr.String())
	}

	// Parse xtrabackup_checkpoints for LSN info
	checkpointsFile := filepath.Join(targetDir, "xtrabackup_checkpoints")
	cpData, err := os.ReadFile(checkpointsFile)
	if err != nil {
		return nil, fmt.Errorf("read xtrabackup_checkpoints: %w", err)
	}

	lsnMap := parseXtraCheckpoints(string(cpData))
	fromLSN := lsnMap["from_lsn"]
	toLSN := lsnMap["to_lsn"]
	backupType := lsnMap["backup_type"]

	fmt.Printf("[xtrabackup] backup complete: type=%s from_lsn=%s to_lsn=%s\n", backupType, fromLSN, toLSN)

	// Tar + gzip the backup directory
	var buf bytes.Buffer
	gzWriter := gzip.NewWriter(&buf)
	tarWriter := tar.NewWriter(gzWriter)

	err = filepath.Walk(targetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relPath, _ := filepath.Rel(targetDir, path)
		if relPath == "." {
			return nil
		}

		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = relPath

		if err := tarWriter.WriteHeader(header); err != nil {
			return err
		}

		if !info.IsDir() {
			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			if _, err := tarWriter.Write(data); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("tar backup dir: %w", err)
	}

	if err := tarWriter.Close(); err != nil {
		return nil, fmt.Errorf("close tar: %w", err)
	}
	if err := gzWriter.Close(); err != nil {
		return nil, fmt.Errorf("close gzip: %w", err)
	}

	// Create S3 client and upload
	client, err := NewS3ClientFromProvider(prov)
	if err != nil {
		return nil, fmt.Errorf("create s3 client: %w", err)
	}

	// Build storage key
	isIncremental := lastLSN != ""
	backupDir := "full"
	if isIncremental {
		backupDir = "incr"
	}
	key := fmt.Sprintf("xtrabackup/%s/%s/%s/%s.tar.gz", conn.Name, backupDir, backupID, backupID)

	ctx := context.Background()
	reader := bytes.NewReader(buf.Bytes())
	if err := client.Upload(ctx, key, reader, int64(buf.Len())); err != nil {
		return nil, fmt.Errorf("upload to s3: %w", err)
	}

	fmt.Printf("[xtrabackup] uploaded to s3: %s (%d bytes)\n", key, buf.Len())

	metadata := map[string]string{
		"engine":      "xtrabackup",
		"from_lsn":    fromLSN,
		"to_lsn":      toLSN,
		"backup_type": backupType,
		"s3_key":      key,
		"bucket":      prov.Bucket,
		"conn_name":   conn.Name,
		"provider_id": sch.StorageProviderID,
	}

	return metadata, nil
}

// NewS3ClientFromProvider creates an S3 client from a storage provider.
func NewS3ClientFromProvider(prov *storage.Provider) (*storage.S3Client, error) {
	cfg := storage.Config{
		Endpoint:  prov.Endpoint,
		Region:    prov.Region,
		Bucket:    prov.Bucket,
		AccessKey: prov.AccessKey,
		SecretKey: prov.SecretKey,
		PathStyle: prov.PathStyle,
	}
	return storage.NewS3Client(cfg)
}

// parseXtraCheckpoints parses xtrabackup_checkpoints file content.
func parseXtraCheckpoints(content string) map[string]string {
	result := make(map[string]string)
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			result[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	return result
}
