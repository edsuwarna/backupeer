---
title: 'Running Backups'
description: 'How to run backups manually, full backup vs incremental, one-shot vs scheduled, and monitoring output'
---

# Running Backups

Backupeer supports multiple ways to run backups: **one-shot manual backups**, **scheduled backups** via cron expressions, and both **full** and **incremental** backup types. This page covers how to execute and monitor them.

## Backup Types

### Full Backup

A full backup dumps the entire database, compresses it with gzip, optionally encrypts it with AES-256-GCM, and streams it directly to S3-compatible storage.

**Databases supported:**

| Database | Tool | Notes |
|----------|------|-------|
| PostgreSQL | `pg_dump` | Custom format (`--format=c`) with `--clean --if-exists` |
| MySQL | `mysqldump` | `--single-transaction --routines --triggers --events` |
| MariaDB | `mariadb-dump` or `mysqldump` | Prefers `mariadb-dump` if available |

**Streaming pipeline:**

```
pg_dump/mysqldump → count → gzip → SHA-256 → (encrypt) → S3
```

### Incremental Backup

Incremental backups capture only changes since the last full backup, saving storage space and time. Backupeer uses battle-tested third-party tools:

| Database | Engine | Tool |
|----------|--------|------|
| PostgreSQL | pgBackRest | `pgbackrest --type=incr backup` |
| MySQL | XtraBackup | `xtrabackup --backup --stream=xbstream` |
| MariaDB | Mariabackup | `mariabackup --backup --stream=xbstream` |

Incremental backups also stream through gzip compression → S3, with no disk usage.

> **Note**: For incremental backups to work, the corresponding tool must be installed on the Backupeer server and available in PATH.

## Running Backups Manually

### Via Web UI

1. Navigate to **Backups** in the left sidebar
2. Click **+ New Backup**
3. Select the **connection** (database server)
4. Select the **database** to back up
5. Choose **backup type**: `full` or `incremental`
6. Select the **storage provider** (or use default)
7. Configure **notification preferences**
8. Click **Start Backup**

The backup will begin immediately, and you'll see a new entry in the backup list with status `running`.

### Via API

```bash
# Full backup
curl -X POST http://localhost:8080/api/backups \
  -H "Content-Type: application/json" \
  -H "Authorization: <session-token>" \
  -d '{
    "connection_id": "<connection-id>",
    "database_id": "<database-id>",
    "backup_type": "full"
  }'

# Incremental backup
curl -X POST http://localhost:8080/api/backups \
  -H "Content-Type: application/json" \
  -H "Authorization: <session-token>" \
  -d '{
    "connection_id": "<connection-id>",
    "database_id": "<database-id>",
    "backup_type": "incremental"
  }'
```

## Scheduled Backups

Scheduled backups run automatically according to a cron expression. Each schedule targets one database on one connection with a specific backup type, storage provider, and retention policy.

### Creating a Schedule

#### Via Web UI

1. Go to **Schedules > Create Schedule**
2. Select the **connection** and **database**
3. Set the **cron expression** (e.g., `0 2 * * *` for daily at 2 AM)
4. Choose **backup type** (full or incremental)
5. Set **retention policy** (how many full/incremental backups to keep)
6. Select **storage provider** and **encryption preferences**
7. **Save**

#### Via API

```bash
curl -X POST http://localhost:8080/api/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: <session-token>" \
  -d '{
    "connection_id": "<connection-id>",
    "database_id": "<database-id>",
    "backup_type": "full",
    "cron_expr": "0 2 * * *",
    "storage_provider_id": "<provider-id>",
    "retention_full": 7,
    "retention_incr": 30,
    "notify_on_success": true,
    "notify_on_failure": true
  }'
```

### Running a Schedule Now

You can trigger a scheduled backup immediately (without waiting for the cron time):

```bash
curl -X POST http://localhost:8080/api/schedules/<schedule-id>/run \
  -H "Authorization: <session-token>"
```

### Disabling a Schedule

Set `enabled: false` to pause a schedule without deleting it. The cron entry is removed from the scheduler until re-enabled.

## One-Shot vs Scheduled

| Aspect | One-Shot | Scheduled |
|--------|----------|-----------|
| **Trigger** | Manual (UI or API) | Automatic (cron) |
| **Retention** | Not enforced automatically | Enforced after each backup |
| **Use case** | Ad-hoc, before maintenance, on-demand | Routine backups (daily, hourly) |
| **Notifications** | Per-request options | Configured on the schedule |

## Monitoring Backup Output

### Backup Status

Each backup goes through these statuses:

| Status | Description |
|--------|-------------|
| `running` | Backup is in progress |
| `success` | Backup completed successfully |
| `failed` | Backup encountered an error |
| `verifying` | Integrity verification in progress |

### Viewing Logs

#### Via Web UI

Click on any backup in the list to view its details and full log output.

#### Via API

```bash
# Get backup details
curl -H "Authorization: <session-token>" \
  http://localhost:8080/api/backups/<backup-id>

# Get backup logs only
curl -H "Authorization: <session-token>" \
  http://localhost:8080/api/backups/<backup-id>/logs
```

### Log Output Examples

**Successful full backup:**
```
BACKUP: streaming postgresql mydb
DUMP: postgresql started
DUMP: 4294967296 bytes uncompressed
```

**Failed backup:**
```
STORAGE PROVIDER ERROR: no storage provider configured — add one in Settings > Storage
```

### Backup Limitations

- **Maximum concurrent backups**: 3 (configurable via `BACKUPEER_MAX_CONCURRENT`)
- **List pagination**: Maximum 100 backups per request (default 50)
- **Incremental prerequisites**: The corresponding engine tool must be installed

## Retention Policy

Scheduled backups automatically enforce retention. After each backup completes:

1. **Full backups**: Only the most recent N are kept (configured per schedule)
2. **Incremental backups**: Only the most recent N are kept

Old backups are deleted from both the database records and object storage automatically.

## Verification

Backups can be verified after completion to ensure integrity:

```bash
curl -X POST http://localhost:8080/api/backups/<backup-id>/verify \
  -H "Authorization: <session-token>"
```

Verification downloads the backup, decrypts it if needed, and compares the computed SHA-256 checksum against the stored checksum.
