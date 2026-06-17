---
title: 'Restore'
description: 'Restore from full backup, restore from incremental chain, point-in-time recovery, and dry-run verification'
---

# Restore

Jagad supports restoring backups to the original database server or to an alternative target. Both full and incremental backups can be restored, with integrity verification available before execution.

## Restore Types

### Full Backup Restore

Restoring from a full backup downloads the compressed (and optionally encrypted) backup from object storage, decrypts it, decompresses it, and pipes it to the native database restore tool.

**Restore pipeline:**

```
S3 download → (decrypt) → gzip decompress → pg_restore / mysql / mariadb
```

### Incremental Backup Restore

Incremental backup restore is handled by the underlying engine tools (pgBackRest, XtraBackup, Mariabackup). These tools automatically manage the chain:

- **pgBackRest**: Uses the stanza and WAL archive to replay to the desired point
- **XtraBackup/Mariabackup**: Requires prepare (apply logs) on the full + incremental backups before restore

> **Note**: Direct incremental restore via Jagad API is currently limited to full backup restore. For incremental chain restore, use the engine's own tools (pgbackrest restore, xtrabackup --prepare, mariabackup --prepare).

### Point-in-Time Recovery (PITR)

For **PostgreSQL** with pgBackRest, point-in-time recovery is supported through pgBackRest's native capabilities. You can restore to a specific timestamp, transaction ID, or named restore point using pgBackRest directly:

```bash
pgbackrest --config=<config> --stanza=<stanza> \
  --type=time "--target=2024-12-25 14:30:00 EST" \
  --target-action=promote restore
```

For MySQL/MariaDB with XtraBackup/Mariabackup, PITR requires applying binary logs on top of the restored backup.

## Restoring a Backup

### Via Web UI

1. Navigate to **Backups** and find the backup you want to restore
2. Click the **Restore** button (or the backup ID to view details, then click Restore)
3. Choose a **target connection** (defaults to the original database server)
4. Review the backup metadata (size, date, checksum)
5. Click **Start Restore**

The restore will begin, and you'll see a new restore entry with status `running`.

### Via API

```bash
# Restore to original database server
curl -X POST http://localhost:8080/api/backups/<backup-id>/restore \
  -H "Content-Type: application/json" \
  -H "Authorization: <session-token>" \
  -d '{}'

# Restore to a different database server
curl -X POST http://localhost:8080/api/backups/<backup-id>/restore \
  -H "Content-Type: application/json" \
  -H "Authorization: <session-token>" \
  -d '{
    "target_connection": "<target-connection-id>"
  }'
```

### Via Command Line (Direct Tool)

For large databases or advanced scenarios, you can download the backup file and restore it manually:

```bash
# Download the backup file
curl -O -J -H "Authorization: <token>" \
  http://localhost:8080/api/backups/<backup-id>/download

# Decrypt (if encrypted) and decompress
# Then pipe to native restore tool
```

## Dry-Run Verification

Before actually restoring, you can verify backup integrity with a **dry-run**:

```bash
curl -X POST http://localhost:8080/api/backups/<backup-id>/verify \
  -H "Authorization: <session-token>"
```

This process:

1. Downloads the backup from S3 (streaming)
2. Decrypts if encryption was enabled
3. Computes SHA-256 checksum of the compressed data
4. Compares against the stored checksum (from backup time)

If checksums match, the backup is verified intact — you can restore with confidence.

### Verify Statuses

| Status | Description |
|--------|-------------|
| `pending` | Not yet verified |
| `verifying` | Verification in progress |
| `passed` | Checksum matches — integrity confirmed |
| `failed` | Checksum mismatch or download error |

## Understanding the Restore Process

### Step-by-Step

1. **Validate backup**: Jagad checks that the backup has status `success` and exists
2. **Resolve storage provider**: The provider used when the backup was created
3. **Download from S3**: Streams the backup object into memory
4. **Decrypt**: If encrypted, decrypts using AES-256-GCM
5. **Decompress**: Gunzip decompression
6. **Pipe to restore tool**: Forwards decompressed data to the appropriate database restore command
7. **Record result**: On success, the restore is marked `success`; on failure, `failed` with error logs

### Database Restore Commands

| Database | Restore Tool | Command |
|----------|-------------|---------|
| PostgreSQL | `pg_restore` | `pg_restore --clean --if-exists --dbname=postgres` |
| MySQL | `mysql` | `mysql -h <host> -u <user>` |
| MariaDB | `mariadb` or `mysql` | `mariadb -h <host> -u <user>` |

## Restore to Alternative Target

You can restore a backup to a different database server by specifying a `target_connection`. This must be a pre-configured connection in Jagad. The target connection must be of the same database type (PostgreSQL backup → PostgreSQL server, MySQL backup → MySQL server).

This is useful for:

- **Disaster recovery**: Restoring to a standby or DR site
- **Testing**: Restoring production backups to a staging environment
- **Migration**: Moving data to a different database server

## Monitoring Restores

### Via Web UI

All restore operations are listed under **Restores** in the UI. Each entry shows:

- Backup ID (source)
- Target connection
- Status (running, success, failed)
- Duration
- Timestamp

### Via API

```bash
# List all restores
curl -H "Authorization: <session-token>" \
  http://localhost:8080/api/restores

# Get specific restore details
curl -H "Authorization: <session-token>" \
  http://localhost:8080/api/restores/<restore-id>
```

### Log Output

Each restore records full log output showing every step:

```
DOWNLOAD: backups/myserver/mydb/abc123-20250101-020000.sql.gz (4294967296 bytes)
DECRYPT: OK (AES-256-GCM)
DECOMPRESS: 1073741824 -> 4294967296 bytes
RESTORE: OK
```

## Troubleshooting Restores

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `backup not found` | Invalid backup ID | Check the backup ID |
| `cannot restore backup with status: running` | Backup still in progress | Wait for completion |
| `cannot restore backup with status: failed` | Backup failed | Check backup logs, re-run the backup |
| `STORAGE PROVIDER ERROR` | Storage not configured | Configure storage provider in Settings |
| `DOWNLOAD ERROR` | S3 access issue | Check bucket permissions and credentials |
| `DECRYPT ERROR` | Encryption key changed | Restore with the original encryption key |
| `RESTORE ERROR` | Database access issue | Check target connection credentials |

### Checksum Mismatch

If a backup fails verification with a checksum mismatch, the backup file may be corrupted or tampered with. Try:

1. Re-running the backup
2. Checking S3 bucket for data integrity
3. Verifying network stability during the original upload
