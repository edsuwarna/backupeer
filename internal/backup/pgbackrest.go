package backup

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"text/template"

	"github.com/edsuwarna/jagad/internal/connection"
)

// PGBackRestEngine implements IncrementalEngine for PostgreSQL using pgBackRest.
type PGBackRestEngine struct {
	provSvc ProviderService
}

// NewPGBackRestEngine creates a new pgBackRest engine.
func NewPGBackRestEngine(provSvc ProviderService) *PGBackRestEngine {
	return &PGBackRestEngine{provSvc: provSvc}
}

func (e *PGBackRestEngine) DBType() string { return "postgresql" }

// pgbackrestConfigTemplate for generating pgBackRest configuration.
const pgbackrestConfigTemplate = `[{{.Stanza}}]
pg1-host={{.Host}}
pg1-port={{.Port}}
pg1-database={{.Database}}
pg1-user={{.User}}
pg1-password={{.Password}}

[global]
repo1-type=s3
repo1-s3-bucket={{.Bucket}}
repo1-s3-region={{.Region}}
repo1-s3-endpoint={{.Endpoint}}
repo1-s3-key={{.AccessKey}}
repo1-s3-key-secret={{.SecretKey}}
repo1-s3-uri-style={{.PathStyle}}
repo1-path=/{{.BasePath}}/{{.Stanza}}/
repo1-retention-full={{.RetentionFull}}
repo1-retention-diff={{.RetentionDiff}}
repo1-retention-archive={{.RetentionArchive}}
process-max=2
compress-type=zst
compress-level=6
`

type pgbrConfigData struct {
	Stanza           string
	Host             string
	Port             string
	Database         string
	User             string
	Password         string
	Bucket           string
	Region           string
	Endpoint         string
	AccessKey        string
	SecretKey        string
	PathStyle        string
	BasePath         string
	RetentionFull    int
	RetentionDiff    int
	RetentionArchive int
}

func (e *PGBackRestEngine) BackupFull(sch IncrementalSchedule, conn *connection.Connection, backupID string) (map[string]string, error) {
	return e.runBackup(sch, conn, backupID, "full")
}

func (e *PGBackRestEngine) BackupIncremental(sch IncrementalSchedule, conn *connection.Connection, backupID string) (map[string]string, error) {
	// pgBackRest handles differential & incremental natively.
	// Use "incr" which automatically bases on the last full or diff backup.
	return e.runBackup(sch, conn, backupID, "incr")
}

func (e *PGBackRestEngine) runBackup(sch IncrementalSchedule, conn *connection.Connection, backupID string, pgbrType string) (map[string]string, error) {
	// Resolve storage provider
	prov, err := e.provSvc.GetDecrypted(sch.StorageProviderID)
	if err != nil {
		return nil, fmt.Errorf("get storage provider: %w", err)
	}
	if prov == nil {
		return nil, fmt.Errorf("storage provider %s not found", sch.StorageProviderID)
	}

	// Build base path (prefix in the bucket)
	basePath := fmt.Sprintf("pgbackrest/%s", conn.Name)

	// Stanza = connection name (unique per PG instance)
	stanza := sanitizeStanzaName(conn.Name)

	// Determine path style
	pathStyle := "path"
	if !prov.PathStyle {
		pathStyle = "virtual-hosted"
	}

	// Build config data
	configData := pgbrConfigData{
		Stanza:           stanza,
		Host:             conn.Host,
		Port:             fmt.Sprintf("%d", conn.Port),
		Database:         "", // empty = all databases
		User:             conn.Username,
		Password:         conn.Password,
		Bucket:           prov.Bucket,
		Region:           prov.Region,
		Endpoint:         prov.Endpoint,
		AccessKey:        prov.AccessKey,
		SecretKey:        prov.SecretKey,
		PathStyle:        pathStyle,
		BasePath:         basePath,
		RetentionFull:    2,
		RetentionDiff:    2,
		RetentionArchive: 0,
	}

	// Write config to temp file
	configDir := filepath.Join(os.TempDir(), "jagad", "pgbackrest", sch.ID)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("create config dir: %w", err)
	}
	configPath := filepath.Join(configDir, "pgbackrest.conf")

	var tpl bytes.Buffer
	tmpl := template.Must(template.New("pgbr").Parse(pgbackrestConfigTemplate))
	if err := tmpl.Execute(&tpl, configData); err != nil {
		return nil, fmt.Errorf("render config template: %w", err)
	}

	if err := os.WriteFile(configPath, tpl.Bytes(), 0640); err != nil {
		return nil, fmt.Errorf("write config: %w", err)
	}

	// Step 1: stanza-create (idempotent — safe to run every time)
	stanzaCmd := exec.Command("pgbackrest",
		"--config="+configPath,
		"--stanza="+stanza,
		"stanza-create",
	)
	var stanzaOut, stanzaErr bytes.Buffer
	stanzaCmd.Stdout = &stanzaOut
	stanzaCmd.Stderr = &stanzaErr
	if err := stanzaCmd.Run(); err != nil {
		// If stanza already exists, pgBackRest returns error — that's OK
		fmt.Printf("[pgbackrest] stanza-create stderr: %s\n", stanzaErr.String())
	}

	// Step 2: Run backup
	backupCmd := exec.Command("pgbackrest",
		"--config="+configPath,
		"--stanza="+stanza,
		"--type="+pgbrType,
		"backup",
	)
	var backupOut, backupErr bytes.Buffer
	backupCmd.Stdout = &backupOut
	backupCmd.Stderr = &backupErr

	if err := backupCmd.Run(); err != nil {
		return nil, fmt.Errorf("pgbackrest backup failed: %w\nstderr: %s", err, backupErr.String())
	}

	fmt.Printf("[pgbackrest] backup OK (%s): stdout=%s stderr=%s\n", pgbrType, backupOut.String(), backupErr.String())

	// Store metadata for later restore
	metadata := map[string]string{
		"engine":      "pgbackrest",
		"stanza":      stanza,
		"type":        pgbrType,
		"base_path":   basePath,
		"bucket":      prov.Bucket,
		"config_dir":  configDir,
		"backup_id":   backupID,
		"provider_id": sch.StorageProviderID,
	}
	return metadata, nil
}

// sanitizeStanzaName cleans a connection name to be a valid stanza name.
// pgBackRest stanza names: alphanumeric, hyphens, underscores only.
func sanitizeStanzaName(name string) string {
	result := make([]byte, 0, len(name))
	for i := 0; i < len(name); i++ {
		c := name[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			result = append(result, c)
		} else if c == ' ' || c == '.' {
			result = append(result, '-')
		}
	}
	if len(result) == 0 {
		return "default"
	}
	return string(result)
}
