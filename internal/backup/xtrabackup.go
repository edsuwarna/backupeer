package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os/exec"
	"regexp"
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
	return nil, fmt.Errorf("xtrabackup incremental requires --incremental-lsn; use runXtraBackup directly with lastLSN")
}

// runXtraBackup performs a full or incremental backup using XtraBackup with streaming.
// Uses --stream=xbstream to pipe backup data directly through gzip → S3, no temp disk.
func (e *XtraBackupEngine) runXtraBackup(sch IncrementalSchedule, conn *connection.Connection, backupID string, lastLSN string) (map[string]string, error) {
	// Resolve storage provider
	prov, err := e.provSvc.GetDecrypted(sch.StorageProviderID)
	if err != nil {
		return nil, fmt.Errorf("get storage provider: %w", err)
	}
	if prov == nil {
		return nil, fmt.Errorf("storage provider %s not found", sch.StorageProviderID)
	}

	// Create S3 client
	client, err := NewS3ClientFromProvider(prov)
	if err != nil {
		return nil, fmt.Errorf("create s3 client: %w", err)
	}

	// Build xtrabackup command with streaming
	args := []string{
		"--backup",
		"--stream=xbstream",
		"--host=" + conn.Host,
		"--port=" + fmt.Sprintf("%d", conn.Port),
		"--user=" + conn.Username,
		"--password=" + conn.Password,
		"--parallel=4",
	}
	if lastLSN != "" {
		args = append(args, "--incremental-lsn="+lastLSN)
	}

	cmd := exec.Command("xtrabackup", args...)

	// Pipe stdout to S3, capture stderr for metadata
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}
	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("xtrabackup start: %w", err)
	}

	// Streaming pipeline: xbstream stdout → gzip → S3 multipart upload
	isIncremental := lastLSN != ""
	backupDir := "full"
	if isIncremental {
		backupDir = "incr"
	}
	key := fmt.Sprintf("xtrabackup/%s/%s/%s/%s.tar.gz", conn.Name, backupDir, backupID, backupID)

	pr, pw := io.Pipe()
	errChan := make(chan error, 1)

	go func() {
		defer pw.Close()
		defer close(errChan)

		gw := gzip.NewWriter(pw)
		_, copyErr := io.Copy(gw, stdout)
		gw.Close()
		if copyErr != nil {
			errChan <- fmt.Errorf("compress: %w", copyErr)
			return
		}
		errChan <- nil
	}()

	// Upload to S3 (streaming, auto multipart)
	ctx := context.Background()
	if uploadErr := client.UploadStream(ctx, key, pr); uploadErr != nil {
		pr.Close()
		<-errChan
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		cmd.Wait()
		return nil, fmt.Errorf("upload to s3: %w", uploadErr)
	}

	// Wait for compression goroutine
	if compErr := <-errChan; compErr != nil {
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		cmd.Wait()
		return nil, compErr
	}

	// Wait for xtrabackup to finish
	if waitErr := cmd.Wait(); waitErr != nil {
		return nil, fmt.Errorf("xtrabackup failed: %w\nstderr: %s", waitErr, stderrBuf.String())
	}

	fmt.Printf("[xtrabackup] streaming backup OK: key=%s\n", key)

	// Parse LSN metadata from stderr
	lsnMap := parseXtraStderr(stderrBuf.String())
	fromLSN := lsnMap["from_lsn"]
	toLSN := lsnMap["to_lsn"]
	backupType := lsnMap["backup_type"]

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

// parseXtraStderr parses xtrabackup stderr output for LSN and backup type.
// When using --stream=xbstream, LSN info is printed to stderr instead of
// written to xtrabackup_checkpoints file.
func parseXtraStderr(stderr string) map[string]string {
	result := make(map[string]string)

	// Extract "The latest check point (for incremental): '12345678'"
	re := regexp.MustCompile(`The latest check point[^']*'(\d+)'`)
	if m := re.FindStringSubmatch(stderr); len(m) >= 2 {
		result["to_lsn"] = m[1]
	}

	// Extract "backup_type = full-prepared" or similar from any embedded checkpoints
	for _, line := range strings.Split(stderr, "\n") {
		line = strings.TrimSpace(line)
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			if key == "backup_type" || key == "from_lsn" || key == "to_lsn" {
				result[key] = val
			}
		}
	}

	// Fallback: if backup info was in checkpoints, from_lsn = 0 for full
	if result["backup_type"] == "" {
		result["backup_type"] = "full-prepared"
	}
	if result["from_lsn"] == "" {
		result["from_lsn"] = "0"
	}

	return result
}
