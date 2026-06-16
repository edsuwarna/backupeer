package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os/exec"

	"github.com/edsuwarna/backupeer/internal/connection"
)

// MariabackupEngine implements IncrementalEngine for MariaDB using Mariabackup.
type MariabackupEngine struct {
	provSvc ProviderService
}

// NewMariabackupEngine creates a new Mariabackup engine.
func NewMariabackupEngine(provSvc ProviderService) *MariabackupEngine {
	return &MariabackupEngine{provSvc: provSvc}
}

func (e *MariabackupEngine) DBType() string { return "mariadb" }

func (e *MariabackupEngine) BackupFull(sch IncrementalSchedule, conn *connection.Connection, backupID string) (map[string]string, error) {
	return e.runMariabackup(sch, conn, backupID, "")
}

func (e *MariabackupEngine) BackupIncremental(sch IncrementalSchedule, conn *connection.Connection, backupID string) (map[string]string, error) {
	return nil, fmt.Errorf("mariabackup incremental requires --incremental-lsn; use runMariabackup directly with lastLSN")
}

// runMariabackup performs streaming backup using mariabackup --stream=xbstream.
func (e *MariabackupEngine) runMariabackup(sch IncrementalSchedule, conn *connection.Connection, backupID string, lastLSN string) (map[string]string, error) {
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

	// Build mariabackup command with streaming
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

	// Try mariabackup binary first, fall back to xtrabackup
	binary := "mariabackup"
	if _, err := exec.LookPath(binary); err != nil {
		if _, err2 := exec.LookPath("xtrabackup"); err2 == nil {
			binary = "xtrabackup"
			fmt.Printf("[mariabackup] mariabackup not found, falling back to xtrabackup\n")
		} else {
			return nil, fmt.Errorf("neither mariabackup nor xtrabackup found in PATH")
		}
	}

	cmd := exec.Command(binary, args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}
	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("%s start: %w", binary, err)
	}

	// Streaming pipeline: xbstream stdout → gzip → S3 multipart upload
	isIncremental := lastLSN != ""
	backupDir := "full"
	if isIncremental {
		backupDir = "incr"
	}
	key := fmt.Sprintf("mariabackup/%s/%s/%s/%s.tar.gz", conn.Name, backupDir, backupID, backupID)

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

	// Wait for backup process to finish
	if waitErr := cmd.Wait(); waitErr != nil {
		return nil, fmt.Errorf("%s failed: %w\nstderr: %s", binary, waitErr, stderrBuf.String())
	}

	fmt.Printf("[mariabackup] streaming backup OK: key=%s\n", key)

	// Parse LSN metadata from stderr
	lsnMap := parseXtraStderr(stderrBuf.String())
	fromLSN := lsnMap["from_lsn"]
	toLSN := lsnMap["to_lsn"]
	backupType := lsnMap["backup_type"]

	metadata := map[string]string{
		"engine":       "mariabackup",
		"from_lsn":     fromLSN,
		"to_lsn":       toLSN,
		"backup_type":  backupType,
		"s3_key":       key,
		"bucket":       prov.Bucket,
		"conn_name":    conn.Name,
		"provider_id":  sch.StorageProviderID,
		"binary_used":  binary,
	}

	return metadata, nil
}
