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

func (e *MariabackupEngine) runMariabackup(sch IncrementalSchedule, conn *connection.Connection, backupID string, lastLSN string) (map[string]string, error) {
	prov, err := e.provSvc.GetDecrypted(sch.StorageProviderID)
	if err != nil {
		return nil, fmt.Errorf("get storage provider: %w", err)
	}
	if prov == nil {
		return nil, fmt.Errorf("storage provider %s not found", sch.StorageProviderID)
	}

	tmpDir := filepath.Join(os.TempDir(), "backupeer", "mariabackup", backupID)
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return nil, fmt.Errorf("create tmp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	targetDir := filepath.Join(tmpDir, "data")
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return nil, fmt.Errorf("create target dir: %w", err)
	}

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
	var cmdOut, cmdErr bytes.Buffer
	cmd.Stdout = &cmdOut
	cmd.Stderr = &cmdErr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("%s failed: %w\noutput: %s", binary, err, cmdErr.String())
	}

	checkpointsFile := filepath.Join(targetDir, "xtrabackup_checkpoints")
	cpData, err := os.ReadFile(checkpointsFile)
	if err != nil {
		return nil, fmt.Errorf("read checkpoints: %w", err)
	}

	lsnMap := parseXtraCheckpoints(string(cpData))
	fromLSN := lsnMap["from_lsn"]
	toLSN := lsnMap["to_lsn"]
	backupType := lsnMap["backup_type"]

	fmt.Printf("[mariabackup] backup complete: type=%s from_lsn=%s to_lsn=%s\n", backupType, fromLSN, toLSN)

	// Tar + gzip
	var buf bytes.Buffer
	gzWriter := gzip.NewWriter(&buf)
	tarWriter := tar.NewWriter(gzWriter)

	filepath.Walk(targetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relPath, _ := filepath.Rel(targetDir, path)
		if relPath == "." {
			return nil
		}
		header, _ := tar.FileInfoHeader(info, "")
		header.Name = relPath
		tarWriter.WriteHeader(header)
		if !info.IsDir() {
			data, _ := os.ReadFile(path)
			tarWriter.Write(data)
		}
		return nil
	})
	tarWriter.Close()
	gzWriter.Close()

	// Upload to S3
	client, err := NewS3ClientFromProvider(prov)
	if err != nil {
		return nil, fmt.Errorf("create s3 client: %w", err)
	}

	isIncremental := lastLSN != ""
	backupDir := "full"
	if isIncremental {
		backupDir = "incr"
	}
	key := fmt.Sprintf("mariabackup/%s/%s/%s/%s.tar.gz", conn.Name, backupDir, backupID, backupID)

	ctx := context.Background()
	reader := bytes.NewReader(buf.Bytes())
	if err := client.Upload(ctx, key, reader, int64(buf.Len())); err != nil {
		return nil, fmt.Errorf("upload to s3: %w", err)
	}

	fmt.Printf("[mariabackup] uploaded to s3: %s (%d bytes)\n", key, buf.Len())

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
