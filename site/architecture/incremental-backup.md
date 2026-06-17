---
title: 'Incremental Backup'
---

# Incremental Backup

Jagad supports incremental backups for all three supported database types through integration with mature, battle-tested third-party tools. This document explains how incremental backups work, how LSN tracking enables efficient change capture, and how the incremental chain is reconstructed during restore.

---

## Architecture Overview

Incremental backups use a **pluggable engine architecture** defined by the `IncrementalEngine` interface:

```go
type IncrementalEngine interface {
    DBType() string
    BackupFull(sch IncrementalSchedule, conn *connection.Connection, backupID string) (metadata map[string]string, err error)
    BackupIncremental(sch IncrementalSchedule, conn *connection.Connection, backupID string) (metadata map[string]string, err error)
}
```

Each database type has its own engine implementation:

| Database | Engine | Tool | Backup Method |
|---|---|---|---|
| PostgreSQL | `PGBackRestEngine` | pgBackRest | WAL archiving + full/differential/incr |
| MySQL | `XtraBackupEngine` | Percona XtraBackup | Page-level changed page tracking (LSN) |
| MariaDB | `MariabackupEngine` | Mariabackup (or XtraBackup) | Page-level changed page tracking (LSN) |

Engines are registered at startup and dispatched based on the connection's `DBType`:

```go
registry := backup.NewIncrementalEngineRegistry()
registry.Register(backup.NewPGBackRestEngine(provSvc))
registry.Register(backup.NewXtraBackupEngine(provSvc))
registry.Register(backup.NewMariabackupEngine(provSvc))
```

---

## PostgreSQL: WAL Archiving via pgBackRest

### How It Works

pgBackRest manages PostgreSQL backup and restore using **Write-Ahead Log (WAL)** archiving. Unlike simple `pg_dump`, pgBackRest:

1. Takes a **full backup** (file-level copy of the database cluster)
2. Continuously archives WAL segments as PostgreSQL generates them
3. Supports **differential backups** (all changes since last full) and **incremental backups** (all changes since last backup)

### Integration in Jagad

Jagad generates a pgBackRest configuration file dynamically for each backup:

```
[stanza_name]
pg1-host=db.example.com
pg1-port=5432
pg1-database=
pg1-user=backup_user
pg1-password=****

[global]
repo1-type=s3
repo1-s3-bucket=backups
repo1-s3-region=auto
repo1-s3-endpoint=s3.amazonaws.com
repo1-s3-key=AKIA***
repo1-s3-key-secret=****
repo1-s3-uri-style=path
repo1-path=/pgbackrest/my-production/
repo1-retention-full=2
repo1-retention-diff=2
compress-type=zst
compress-level=6
```

**Backup flow:**

```go
func (e *PGBackRestEngine) runBackup(sch IncrementalSchedule, conn *connection.Connection, backupID string, pgbrType string) (map[string]string, error) {
    // 1. Write pgBackRest config to temp file
    configPath := writeConfig(conn, prov, stanza)

    // 2. Create stanza (idempotent)
    exec.Command("pgbackrest", "--config="+configPath, "--stanza="+stanza, "stanza-create").Run()

    // 3. Run backup
    //    pgbrType = "full" for full, "incr" for incremental
    exec.Command("pgbackrest", "--config="+configPath, "--stanza="+stanza, "--type="+pgbrType, "backup").Run()

    // 4. Return metadata (stanza, base_path, bucket, etc.)
    return metadata, nil
}
```

### pgBackRest Backup Types

| Type | Command | Data Captured | Size vs Full |
|---|---|---|---|
| **Full** | `--type=full` | Entire database cluster | 100% |
| **Differential** | `--type=diff` | Changes since last full | 10-30% |
| **Incremental** | `--type=incr` | Changes since last backup (any type) | 1-5% |

Jagad uses `--type=incr` for incremental backups, letting pgBackRest automatically determine the best base backup.

### WAL Archiving

pgBackRest requires PostgreSQL to be configured with `archive_mode=on` and `archive_command` pointing to `pgbackrest --stanza=<name> archive-push`. This is a prerequisite that must be configured on the PostgreSQL server — Jagad does not manage this automatically.

### Restore with Incrementals

During restore, pgBackRest automatically:

1. Downloads the full backup from S3
2. Applies all archived WAL segments to bring the cluster to the desired point in time
3. Applies any differential/incremental backup layers on top

The restore process reconstructs the entire chain transparently:

```
Full Backup (T0) ────▶ Diff Backup (T1) ────▶ Incr Backup (T2)
       │                        │                       │
       └────────────────────────┴───────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  pgBackRest restore   │
                    │  (auto-detects chain) │
                    └───────────────────────┘
```

---

## MySQL: Changed Page Tracking via XtraBackup

### How It Works

Percona XtraBackup performs **physical backups** of MySQL by copying InnoDB data files while the server is running. It tracks changes using **Log Sequence Numbers (LSN)**:

1. **Full backup:** Copies all InnoDB data files, records the LSN at the end
2. **Incremental backup:** Uses `--incremental-lsn=<LSN>` to copy only pages changed since that LSN

### Integration in Jagad

XtraBackup supports `--stream=xbstream` which outputs backup data to stdout — enabling the same streaming pipeline pattern:

```go
func (e *XtraBackupEngine) runXtraBackup(...) {
    // 1. Build xtrabackup command with --stream=xbstream
    args := []string{
        "--backup",
        "--stream=xbstream",
        "--host=" + conn.Host,
        "--port=" + conn.Port,
        "--user=" + conn.Username,
        "--password=" + conn.Password,
        "--parallel=4",
    }
    if lastLSN != "" {
        args = append(args, "--incremental-lsn="+lastLSN)
    }

    cmd := exec.Command("xtrabackup", args...)
    stdout, _ := cmd.StdoutPipe()

    // 2. Streaming pipeline: xbstream → gzip → S3
    pr, pw := io.Pipe()
    go func() {
        gw := gzip.NewWriter(pw)
        io.Copy(gw, stdout)
        gw.Close()
        pw.Close()
    }()
    client.UploadStream(ctx, key, pr)

    // 3. Parse LSN from stderr
    lsnMap := parseXtraStderr(stderr)
    // Returns: {"from_lsn": "0", "to_lsn": "12345678", "backup_type": "full-prepared"}
}
```

### LSN Tracking

After each backup, Jagad extracts the LSN range from XtraBackup's stderr output:

```
xtrabackup: The latest check point (for incremental): '12345678'
xtrabackup: Stopping log copying thread.
xtrabackup: Transaction log of lsn (12345678) to (12345999) was copied.
```

The `to_lsn` from the previous backup becomes the `--incremental-lsn` for the next incremental:

```
Full Backup:                  from_lsn=0     to_lsn=10000
1st Incremental:              from_lsn=10000 to_lsn=15000
2nd Incremental:              from_lsn=15000 to_lsn=18500
nth Incremental:              from_lsn=nnnnn to_lsn=mmmmm
```

LSNs are stored in backup metadata (as part of the `metadata` map returned by the engine) and used to build incremental chains.

### XtraBackup Streaming Pipeline

```
xtrabackup --stream=xbstream
         │
         ▼ stdout (xbstream format)
    ┌──────────┐
    │  gzip    │
    └────┬─────┘
         ▼
    ┌──────────┐
    │  S3      │
    │  Upload  │
    └──────────┘
    
Memory: ~64 KB (same as full backup pipeline)
Disk:   0 bytes (streaming to S3, no temp files)
```

### Restore with XtraBackup Incrementals

Restoring from XtraBackup incremental backups requires:

1. **Prepare the full backup:** `xtrabackup --prepare --apply-log-only --target-dir=./full`
2. **Apply each incremental in order:** `xtrabackup --prepare --apply-log-only --incremental-dir=./incr1 --target-dir=./full`
3. **Final prepare (non-apply-log-only):** `xtrabackup --prepare --target-dir=./full`
4. **Copy back:** `xtrabackup --copy-back --target-dir=./full`

> **Note:** Incremental restore for XtraBackup currently requires downloading all backup pieces to disk. Streaming restore for XtraBackup is on the roadmap.

---

## MariaDB: Incremental via Mariabackup

### How It Works

Mariabackup is MariaDB's fork of Percona XtraBackup. It uses the **same page-level change tracking mechanism** with LSNs. The integration is nearly identical to XtraBackup.

### Key Differences from XtraBackup

| Aspect | XtraBackup | Mariabackup |
|---|---|---|
| Tool name | `xtrabackup` | `mariabackup` |
| Streaming format | `--stream=xbstream` | `--stream=xbstream` |
| LSN tracking | stderr parsing | stderr parsing |
| InnoDB support | Full | Full (including MariaDB-specific page types) |
| Backup lock | `FLUSH TABLES WITH READ LOCK` | `MariaDB Backup` lock |

### Fallback Support

Jagad checks for `mariabackup` first, then falls back to `xtrabackup`:

```go
binary := "mariabackup"
if _, err := exec.LookPath(binary); err != nil {
    if _, err2 := exec.LookPath("xtrabackup"); err2 == nil {
        binary = "xtrabackup"  // fallback
    }
}
```

This ensures compatibility across environments where only XtraBackup is installed.

---

## Incremental Chain Reconstruction

### Chain Metadata

Each incremental backup stores metadata in the backup record:

```go
metadata := map[string]string{
    "engine":      "xtrabackup",
    "from_lsn":    "10000",
    "to_lsn":      "15000",
    "backup_type": "incremental",
    "s3_key":      "xtrabackup/production/incr/abc123/abc123.tar.gz",
    "bucket":      "backups",
    "provider_id": "prov_001",
}
```

### Chain Structure

```
                  Full Backup
                ┌─────────────┐
                │ LSN: 0-10000│
                │ Key: full/  │
                └──────┬──────┘
                       │
               ┌───────▼────────┐
               │ Incr 1         │
               │ LSN: 10000-    │
               │       15000    │
               │ Key: incr/1/   │
               └───────┬────────┘
                       │
               ┌───────▼────────┐
               │ Incr 2         │
               │ LSN: 15000-    │
               │       18500    │
               │ Key: incr/2/   │
               └───────┬────────┘
                       │
              ┌────────▼────────┐
              │ ... chain       │
              │ continues       │
              └─────────────────┘
```

### Chain Validation

Before performing an incremental backup, Jagad checks:

1. Does a full backup exist? If not, perform a full backup instead.
2. Is the previous backup's `to_lsn` available? If not, fall back to full.
3. Is the storage provider still accessible? If not, fail with a clear error.

```go
prevFull, _ := s.repo.ListOldestByBackupType("", "incremental", 1)
hasPrevious := len(prevFull) > 0

if hasPrevious && b.BackupType == "incremental" {
    metadata, err = engine.BackupIncremental(incrSch, conn, b.ID)
} else {
    // No previous backup — do a full backup instead
    metadata, err = engine.BackupFull(incrSch, conn, b.ID)
}
```

---

## Retention Policy with Incrementals

When incrementals are enabled, retention becomes more nuanced than simple count-based cleanup. Jagad uses a **tiered retention strategy**:

| Tier | Retained | Purpose |
|---|---|---|
| **Full backups** | Last N (e.g., 2) | Base for all incremental chains |
| **Incremental backups** | Last N (e.g., 7) | Point-in-time recovery granularity |

The scheduler enforces retention after each backup run:

```go
func (s *Scheduler) executeBackup(sch *Schedule) {
    // Run backup
    s.runner.StartBackup(...)

    // Enforce retention
    s.runner.EnforceRetention(sch.ID, sch.RetentionFull, sch.RetentionIncr)
}
```

**Retention enforcement:**
1. List all backups for this schedule, ordered by creation date
2. Keep the newest `RetentionFull` full backups
3. Keep the newest `RetentionIncr` incremental backups
4. Delete the rest (both from SQLite and from S3)
5. Log the cleanup actions

> **Warning:** Deleting a full backup that is the base for an incremental chain will make those incrementals unrecoverable. The retention policy is configured per-schedule to ensure chain integrity.

---

## Prerequisites

### PostgreSQL (pgBackRest)

- PostgreSQL with `archive_mode=on` and `archive_command` configured
- `pgbackrest` binary installed on the Jagad host
- Network access from Jagad to PostgreSQL server
- PostgreSQL user with `SUPERUSER` or `REPLICATION` privileges

### MySQL (XtraBackup)

- MySQL 8.0+ or Percona Server
- `xtrabackup` binary installed on the Jagad host
- MySQL user with `RELOAD, PROCESS, LOCK TABLES, REPLICATION CLIENT` privileges
- InnoDB tables (XtraBackup only supports InnoDB/XtraDB)

### MariaDB (Mariabackup)

- MariaDB 10.2+
- `mariabackup` binary installed on the Jagad host
- MariaDB user with `RELOAD, PROCESS, LOCK TABLES, REPLICATION CLIENT` privileges

---

## Comparison: Incremental vs. Full

| Aspect | Full Backup (pg_dump) | Incremental (pgBackRest) |
|---|---|---|
| **Capture method** | Logical dump (SQL) | Physical file copy |
| **Size** | Full DB (~compressed) | Changes only (1-5%) |
| **Speed** | Slow on large DBs | Fast |
| **Restore speed** | Fast (single SQL restore) | Moderate (must reconstruct chain) |
| **Point-in-time recovery** | No | Yes (with WAL) |
| **Streaming pipeline** | Yes (pipe through gzip → encrypt → S3) | Yes (xbstream through gzip → S3) |
| **External dependencies** | pg_dump/mysqldump only | pgBackRest/XtraBackup/Mariabackup |
| **Use case** | Small-medium DBs, logical restore needed | Large DBs, PITR required |

---

## Related

- [Architecture Overview](./overview) — System architecture overview
- [Streaming Pipeline](./streaming-pipeline) — How the streaming pipeline works for full backups
- [Security Model](./security) — Encryption for backup data at rest and in transit
