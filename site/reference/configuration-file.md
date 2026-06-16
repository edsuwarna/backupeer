---
title: 'Configuration File Reference'
description: 'Full YAML schema, all fields with types, default values, and examples'
---

# Configuration File Reference

Backupeer is primarily configured via **environment variables** or **command-line flags** at server startup. The Web UI also maintains application settings stored in the SQLite database. This reference documents both the startup configuration and the Web UI configurable settings.

## Startup Configuration

Backupeer reads configuration at startup from environment variables or CLI flags (CLI flags take precedence). There is no YAML/JSON configuration file for the binary itself; instead, settings are configured via environment variables with the `BACKUPEER_` prefix.

### Environment Variables Reference

#### Server Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BACKUPEER_PORT` | string | `"8080"` | HTTP server listen port |
| `BACKUPEER_DATA_DIR` | string | `"/data"` | Directory for SQLite database and runtime data |
| `BACKUPEER_ADMIN_USER` | string | `"admin"` | Web UI admin username for login |
| `BACKUPEER_ADMIN_PASS` | string | `"admin123"` | Web UI admin password (SHA-256 hashed at startup) |
| `BACKUPEER_SECRET_KEY` | string | Auto-generated | Secret key for session token signing |
| `BACKUPEER_MAX_CONCURRENT` | int | `3` | Maximum number of concurrent backup operations |

#### Encryption Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BACKUPEER_ENCRYPTION_KEY` | string | `""` (disabled) | Master key for AES-256-GCM backup data encryption. If set, all backups are encrypted on-the-fly. |
| `BACKUPEER_MASTER_KEY` | string | `""` (fallback to default) | Master key for encrypting storage provider credentials at rest. If empty, a hardcoded default key is used. |

#### Legacy Storage Settings

These are provided for backward compatibility. In the current version, storage providers are managed through the Web UI/API.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BACKUPEER_S3_ENDPOINT` | string | `""` | S3-compatible storage endpoint URL |
| `BACKUPEER_S3_REGION` | string | `"auto"` | S3 region |
| `BACKUPEER_S3_BUCKET` | string | `"backups"` | S3 bucket name |
| `BACKUPEER_S3_ACCESS_KEY` | string | `""` | S3 access key |
| `BACKUPEER_S3_SECRET_KEY` | string | `""` | S3 secret key |
| `BACKUPEER_S3_PATH_STYLE` | bool | `true` | Use path-style S3 URL addressing (vs virtual-hosted) |

### Example Configuration

#### Minimal (defaults only)

```bash
backupeer
```

Starts on port 8080 with SQLite at `/data`, admin credentials `admin`/`admin123`, no encryption, no storage.

#### Production (with encryption and storage)

```bash
export BACKUPEER_PORT=443
export BACKUPEER_DATA_DIR=/var/lib/backupeer
export BACKUPEER_ADMIN_USER=admin
export BACKUPEER_ADMIN_PASS=$(cat /run/secrets/admin_pass)
export BACKUPEER_SECRET_KEY=$(cat /run/secrets/session_secret)
export BACKUPEER_ENCRYPTION_KEY=$(cat /run/secrets/encryption_key)
export BACKUPEER_MASTER_KEY=$(cat /run/secrets/master_key)
export BACKUPEER_MAX_CONCURRENT=5
backupeer
```

#### Using CLI Flags

```bash
backupeer \
  --port 443 \
  --data-dir /var/lib/backupeer \
  --admin-user admin \
  --admin-pass "$(cat /run/secrets/admin_pass)" \
  --secret-key "$(cat /run/secrets/session_secret)" \
  --encryption-key "$(cat /run/secrets/encryption_key)" \
  --master-key "$(cat /run/secrets/master_key)" \
  --max-concurrent 5
```

## Web UI Settings (Database-Stored)

The Backupeer Web UI allows configuring application settings that are stored in the SQLite database and managed through the Settings API.

### Settings Schema

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `retention_full_default` | int | `7` | Default number of full backups to retain when creating a new schedule |
| `retention_incr_default` | int | `30` | Default number of incremental backups to retain when creating a new schedule |
| `concurrent_backups` | int | `3` | Maximum concurrent backup operations |
| `compression` | string | `"gzip"` | Compression algorithm for backup data |
| `timezone` | string | `"UTC"` | Server timezone for interpreting cron expressions |
| `notify_on_success` | bool | `true` | Default setting for success notifications on new schedules |
| `notify_on_failure` | bool | `true` | Default setting for failure notifications on new schedules |

## Domain Models (API/YAML Reference)

For reference, here are the full schema definitions of major Backupeer domain objects.

### Connection

```yaml
# Connection represents a database server connection.
# Managed via Web UI or POST/GET /api/connections
connection:
  id: "conn_abc123"           # string, auto-generated UUID
  name: "Production PG"       # string, required, human-readable name
  db_type: "postgresql"       # string, required: postgresql, mysql, mariadb
  host: "db.example.com"      # string, required
  port: 5432                  # int, required
  username: "backup_user"     # string, required
  password: "secret"          # string, required on create, never returned in API
  ssl_mode: "prefer"          # string, optional, default: "prefer"
  created_at: "2025-01-01T00:00:00Z"  # datetime, auto
  updated_at: "2025-01-01T00:00:00Z"  # datetime, auto
```

### Database (Discovered)

```yaml
# ConnectionDatabase represents a database discovered on a server.
database:
  id: "db_abc123"             # string, auto-generated UUID
  connection_id: "conn_abc123" # string, parent connection
  db_name: "mydb"             # string, database name
  is_selected: true           # bool, whether to include in backups
  size_bytes: 4294967296      # int64, approximate size
  created_at: "2025-01-01T00:00:00Z"  # datetime, auto
```

### Backup

```yaml
# Backup represents a single backup run for one database.
backup:
  id: "bck_abc123"                # string, auto-generated UUID
  connection_id: "conn_abc123"    # string, connection used
  database_id: "db_abc123"        # string, database backed up
  schedule_id: "sch_abc123"       # string, optional, if run by schedule
  backup_type: "full"             # string: "full" or "incremental"
  status: "success"               # string: running, success, failed, verifying
  storage_path: "backups/Production PG/mydb/bck_abc123-20250101-020000.sql.gz"
  storage_provider_id: "prov_abc123"   # string
  size_bytes: 4294967296          # int64, raw dump size before compression
  encrypted_size_bytes: 4345298944 # int64, size after encryption (if enabled)
  encryption_algo: "AES-256-GCM"  # string, encryption algorithm used
  encryption_key_id: "default"    # string, key identifier
  checksum: "abc123def..."        # string, SHA-256 of compressed data
  encrypted_checksum: "xyz789..." # string, SHA-256 of encrypted data
  verified_at: "2025-01-01T02:02:08Z"  # datetime, last verification
  verify_status: "passed"         # string: pending, passed, failed, verifying
  duration_ms: 128000             # int64, duration in milliseconds
  log_output: "BACKUP: streaming postgresql mydb\nDUMP: started\n..."  # string, full log
  started_at: "2025-01-01T02:00:00Z"      # datetime
  completed_at: "2025-01-01T02:02:08Z"    # datetime
  notif_target_ids: ["notif_abc123"]       # array of strings
  notify_on_success: true         # bool
  notify_on_failure: true         # bool
  created_at: "2025-01-01T02:00:00Z"      # datetime, auto
```

### Schedule

```yaml
# Schedule represents a cron-based backup schedule targeting one database.
schedule:
  id: "sch_abc123"              # string, auto-generated UUID
  connection_id: "conn_abc123"  # string, required
  database_id: "db_abc123"      # string, required
  backup_type: "full"           # string: "full" or "incremental" (default: "full")
  cron_expr: "0 2 * * *"       # string, required, standard 5-field cron expression
  storage_provider_id: "prov_abc123"  # string, required
  encryption_enabled: true      # bool, default: true if encryption key is set
  encryption_key_id: "default"  # string
  verify_enabled: true          # bool, enable post-backup verification
  retention_full: 7             # int, number of full backups to keep
  retention_incr: 30            # int, number of incremental backups to keep
  notif_target_ids: ["notif_abc123"]  # array of strings
  notify_on_success: true       # bool
  notify_on_failure: true       # bool
  enabled: true                 # bool, default: true
  created_at: "2025-01-01T00:00:00Z"  # datetime, auto
```

### Storage Provider

```yaml
# Storage provider for S3-compatible object storage.
storage_provider:
  id: "prov_abc123"             # string, auto-generated UUID
  name: "AWS S3"                # string, required
  provider_type: "s3"           # string: s3, r2, minio, gcs, b2, s3-compat
  endpoint: "https://s3.us-east-1.amazonaws.com"  # string, required
  region: "us-east-1"           # string, default: "auto"
  bucket: "my-backups"          # string, required
  access_key: "AKIA..."         # string, required (encrypted at rest)
  secret_key: "..."             # string, required (encrypted at rest, masked in API)
  path_style: false             # bool, default: true
  is_default: true              # bool, default: false
  created_at: "2025-01-01T00:00:00Z"  # datetime, auto
  updated_at: "2025-01-01T00:00:00Z"  # datetime, auto
```

### Restore

```yaml
# Restore represents a restore operation from a backup.
restore:
  id: "res_abc123"              # string, auto-generated UUID
  backup_id: "bck_abc123"       # string, source backup
  target_connection: "conn_xyz789"  # string, optional target (defaults to original)
  status: "success"             # string: running, success, failed
  duration_ms: 45000            # int64
  log_output: "DOWNLOAD: ...\nDECRYPT: OK\nDECOMPRESS: ...\nRESTORE: OK\n"  # string
  started_at: "2025-01-01T03:00:00Z"    # datetime
  completed_at: "2025-01-01T03:00:45Z"  # datetime
  created_at: "2025-01-01T03:00:00Z"    # datetime, auto
```

### Notification Target

```yaml
# Notification target for backup result alerts.
notification:
  id: "notif_abc123"            # string, auto-generated UUID
  name: "My Telegram"           # string, required
  notif_type: "telegram"        # string: telegram, discord, slack
  config_json: '{"bot_token":"123:ABC","chat_id":"123"}'  # string, required (JSON)
  created_at: "2025-01-01T00:00:00Z"  # datetime, auto
  updated_at: "2025-01-01T00:00:00Z"  # datetime, auto
```

#### Notification Configurations

**Telegram:**
```json
{
  "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "chat_id": "123456789"
}
```

**Discord:**
```json
{
  "webhook_url": "https://discord.com/api/webhooks/123456/ABC-DEF-123"
}
```

**Slack:**
```json
{
  "webhook_url": "https://hooks.slack.com/services/T00/B00/XXXX"
}
```

## Full Example Configuration (Conceptual YAML)

This shows the equivalent YAML for documentation purposes — note that Backupeer does not currently parse this YAML format at startup. Use environment variables or the Web UI instead.

```yaml
# Backupeer Configuration (documentation reference only)
server:
  port: 8080
  data_dir: /data
  max_concurrent: 3

auth:
  admin_user: admin
  admin_pass: admin123
  secret_key: your-secret-key-here

encryption:
  encryption_key: your-encryption-key  # enables AES-256-GCM backup encryption
  master_key: your-master-key          # encrypts provider credentials

legacy_storage:
  endpoint: https://s3.amazonaws.com
  region: us-east-1
  bucket: backups
  access_key: AKIA...
  secret_key: ...
  path_style: false
```
