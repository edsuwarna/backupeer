---
title: 'Configuration'
description: 'Complete reference for the Jagad YAML configuration file — all options with descriptions, types, and examples.'
---

# Configuration

Jagad is configured via a single YAML file. You can also manage all settings through the Web UI, but the YAML file serves as the source of truth.

## Configuration File Location

By default, Jagad looks for configuration in these locations (in order):

1. `./jagad.yaml` (current directory)
2. `$HOME/.config/jagad/config.yaml`
3. `/etc/jagad/config.yaml`

You can specify a custom path with the `--config` flag:

```bash
jagad --config /path/to/config.yaml daemon
```

## Top-Level Structure

```yaml
# General settings
data_dir: ~/.local/share/jagad
log_level: info
max_concurrent_backups: 3

# Database connections
connections:
  - # ... connection definitions

# Storage providers
storage:
  - # ... storage provider definitions

# Backup schedules
schedules:
  - # ... schedule definitions

# Notification targets
notifications:
  - # ... notification target definitions

# Encryption settings
encryption:
  master_key: "your-master-key-here"

# Web UI settings
server:
  host: "0.0.0.0"
  port: 8080
```

## Global Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `data_dir` | string | `~/.local/share/jagad` | Directory for the embedded SQLite database, logs, and runtime data |
| `log_level` | string | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `max_concurrent_backups` | int | `3` | Maximum number of backups to run simultaneously |

## Connections (`connections[]`)

Each connection defines a database server to back up.

```yaml
connections:
  - name: production-postgres           # Unique name for this connection
    db_type: postgresql                 # Database type: postgresql, mysql, mariadb
    host: db.example.com                # Database server hostname/IP
    port: 5432                          # Database server port
    username: backup_user               # Database user with read access
    password: "${DB_PASSWORD}"          # Database password (env var or plaintext)
    ssl_mode: prefer                    # SSL mode (varies by database type)

  - name: staging-mysql
    db_type: mysql
    host: staging-db.example.com
    port: 3306
    username: backup_user
    password: "s3cret"
    ssl_mode: true
```

| Setting | Type | Required | Default | Description |
|---------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Unique name identifier for the connection |
| `db_type` | string | ✅ | — | One of: `postgresql`, `mysql`, `mariadb` |
| `host` | string | ✅ | — | Database server hostname or IP address |
| `port` | int | ✅ | — | Database server port (5432 for PG, 3306 for MySQL/MariaDB) |
| `username` | string | ✅ | — | Database user with read/backup privileges |
| `password` | string | ✅ | — | Database password. Supports `${ENV_VAR}` substitution |
| `ssl_mode` | string | ❌ | `prefer` | SSL/TLS mode. See database-specific docs above |

> **💡 Tip:** Use environment variable substitution (`${VAR}`) for sensitive values like passwords and access keys.

## Storage Providers (`storage[]`)

Each storage provider defines an S3-compatible object storage target.

```yaml
storage:
  - name: primary-s3                   # Unique name for this provider
    provider_type: s3                  # Provider type: s3, r2, minio, gcs, b2, s3-compat
    endpoint: https://s3.us-east-1.amazonaws.com  # S3 endpoint URL
    region: us-east-1                  # Region (may be empty for some providers)
    bucket: my-backups                 # Bucket name
    access_key: "${AWS_ACCESS_KEY_ID}"  # Access key ID
    secret_key: "${AWS_SECRET_ACCESS_KEY}"  # Secret access key
    path_style: false                  # Use path-style addressing (required for MinIO)
    is_default: true                   # Use as default provider for schedules

  - name: r2-backup
    provider_type: r2
    endpoint: https://<account-id>.r2.cloudflarestorage.com
    region: auto
    bucket: jagad-backups
    access_key: "${R2_ACCESS_KEY_ID}"
    secret_key: "${R2_SECRET_ACCESS_KEY}"
    path_style: false
    is_default: false
```

| Setting | Type | Required | Default | Description |
|---------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Unique name identifier for this provider |
| `provider_type` | string | ✅ | — | One of: `s3`, `r2`, `minio`, `gcs`, `b2`, `s3-compat` |
| `endpoint` | string | ✅ | — | S3-compatible endpoint URL |
| `region` | string | ❌ | — | Storage region (may be `auto` or empty for some providers) |
| `bucket` | string | ✅ | — | Bucket/container name |
| `access_key` | string | ✅ | — | Access key ID. Supports `${ENV_VAR}` substitution |
| `secret_key` | string | ✅ | — | Secret access key. Supports `${ENV_VAR}` substitution |
| `path_style` | bool | ❌ | `false` | Use path-style addressing (`bucket/object` vs `bucket.object`) |
| `is_default` | bool | ❌ | `false` | Mark as default provider (used when no provider specified on a schedule) |

See the [Storage Providers](./storage-providers.md) guide for provider-specific endpoint URLs and configurations.

## Schedules (`schedules[]`)

Each schedule defines a recurring backup job.

```yaml
schedules:
  - name: nightly-full                 # Unique name for this schedule
    connection: production-postgres    # Connection name (must match connections[].name)
    database: myapp_production         # Database name to back up
    backup_type: full                  # Backup type: full, incremental
    cron_expr: "0 2 * * *"             # Cron expression (daily at 2 AM)
    storage: primary-s3                # Storage provider name (must match storage[].name)
    retention_full: 7                  # Number of full backups to retain
    retention_incr: 30                 # Number of incremental backups to retain
    encryption_enabled: true           # Enable AES-256-GCM encryption
    notify_on_success: false           # Send notification on successful backup
    notify_on_failure: true            # Send notification on failed backup
    notifications:                     # Notification target names to deliver alerts to
      - ops-team-telegram
      - admin-slack
    enabled: true                      # Enable this schedule
```

| Setting | Type | Required | Default | Description |
|---------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Unique name identifier for this schedule |
| `connection` | string | ✅ | — | Reference to a `connections[].name` |
| `database` | string | ✅ | — | Database name to back up |
| `backup_type` | string | ✅ | — | `full` or `incremental` |
| `cron_expr` | string | ✅ | — | Standard 5-field cron expression |
| `storage` | string | ❌ | default provider | Reference to a `storage[].name` |
| `retention_full` | int | ❌ | `7` | Maximum number of full backups to keep |
| `retention_incr` | int | ❌ | `30` | Maximum number of incremental backups to keep |
| `encryption_enabled` | bool | ❌ | `false` | Enable AES-256-GCM encryption |
| `verify_enabled` | bool | ❌ | `false` | Enable backup verification after upload |
| `notify_on_success` | bool | ❌ | `false` | Send notification on success |
| `notify_on_failure` | bool | ❌ | `true` | Send notification on failure |
| `notifications` | list | ❌ | — | List of `notifications[].name` to alert |
| `enabled` | bool | ❌ | `true` | Whether this schedule is active |

> **💡 Tip:** Use `enabled: false` to temporarily disable a schedule without deleting it.

## Notification Targets (`notifications[]`)

Each notification target defines a delivery channel.

```yaml
notifications:
  - name: ops-team-telegram            # Unique name for this target
    type: telegram                     # Type: telegram, discord, slack, email, webhook
    config:
      bot_token: "${TELEGRAM_BOT_TOKEN}"  # Telegram bot token
      chat_id: "-1001234567890"        # Telegram chat/group ID

  - name: admin-slack
    type: slack
    config:
      webhook_url: "https://hooks.slack.com/services/T00/B00/xxxxx"

  - name: monitor-discord
    type: discord
    config:
      webhook_url: "https://discord.com/api/webhooks/123456/xxxxx"
```

| Setting | Type | Required | Default | Description |
|---------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Unique name for this notification target |
| `type` | string | ✅ | — | One of: `telegram`, `discord`, `slack`, `email`, `webhook` |
| `config` | object | ✅ | — | Type-specific configuration (see below) |

### Telegram Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bot_token` | string | ✅ | Telegram bot token from @BotFather |
| `chat_id` | string | ✅ | Chat ID (can be negative for groups, e.g. `-1001234567890`) |

### Discord Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `webhook_url` | string | ✅ | Discord channel webhook URL |

### Slack Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `webhook_url` | string | ✅ | Slack incoming webhook URL |

## Encryption Settings (`encryption`)

```yaml
encryption:
  master_key: "${JAGAD_MASTER_KEY}"  # Master key for key derivation
```

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `master_key` | string | ❌ | Master key material for AES-256-GCM encryption. Required if any schedule has `encryption_enabled: true`. Supports `${ENV_VAR}` substitution. |

> **⚠️ Security note:** The master key is used with Argon2id key derivation to produce per-backup encryption keys. Keep this key secure and backed up separately — without it, encrypted backups cannot be restored.

## Web UI Server Settings (`server`)

```yaml
server:
  host: "0.0.0.0"                     # Bind address
  port: 8080                           # HTTP port
  tls_cert: /path/to/cert.pem          # TLS certificate (optional)
  tls_key: /path/to/key.pem            # TLS private key (optional)
```

| Setting | Type | Required | Default | Description |
|---------|------|----------|---------|-------------|
| `host` | string | ❌ | `0.0.0.0` | Bind address for the HTTP server |
| `port` | int | ❌ | `8080` | HTTP server port |
| `tls_cert` | string | ❌ | — | Path to TLS certificate file |
| `tls_key` | string | ❌ | — | Path to TLS private key file |

## Complete Example

Here's a full configuration file covering all features:

```yaml
# Global settings
data_dir: /var/lib/jagad
log_level: info
max_concurrent_backups: 3

# Database connections
connections:
  - name: production-postgres
    db_type: postgresql
    host: pg.example.com
    port: 5432
    username: jagad
    password: "${PG_PASSWORD}"
    ssl_mode: prefer

  - name: production-mysql
    db_type: mysql
    host: mysql.example.com
    port: 3306
    username: jagad
    password: "${MYSQL_PASSWORD}"
    ssl_mode: true

# Storage providers
storage:
  - name: aws-s3
    provider_type: s3
    endpoint: https://s3.eu-west-1.amazonaws.com
    region: eu-west-1
    bucket: my-company-backups
    access_key: "${AWS_ACCESS_KEY_ID}"
    secret_key: "${AWS_SECRET_ACCESS_KEY}"
    path_style: false
    is_default: true

  - name: r2-backup
    provider_type: r2
    endpoint: https://<account-id>.r2.cloudflarestorage.com
    region: auto
    bucket: jagad-backups
    access_key: "${R2_ACCESS_KEY_ID}"
    secret_key: "${R2_SECRET_ACCESS_KEY}"
    path_style: false
    is_default: false

# Backup schedules
schedules:
  - name: daily-full-pg
    connection: production-postgres
    database: myapp_production
    backup_type: full
    cron_expr: "0 2 * * *"
    storage: aws-s3
    retention_full: 14
    encryption_enabled: true
    notify_on_failure: true
    notifications:
      - ops-telegram
      - admin-slack
    enabled: true

  - name: hourly-incr-mysql
    connection: production-mysql
    database: myapp_production
    backup_type: incremental
    cron_expr: "0 * * * *"
    storage: aws-s3
    retention_incr: 48
    encryption_enabled: true
    notify_on_failure: true
    notifications:
      - ops-telegram
    enabled: true

# Notification targets
notifications:
  - name: ops-telegram
    type: telegram
    config:
      bot_token: "${TELEGRAM_BOT_TOKEN}"
      chat_id: "-1001234567890"

  - name: admin-slack
    type: slack
    config:
      webhook_url: "${SLACK_WEBHOOK_URL}"

# Encryption
encryption:
  master_key: "${JAGAD_MASTER_KEY}"

# Web UI
server:
  host: "0.0.0.0"
  port: 8080
```

## Environment Variable Substitution

Jagad supports `${VAR_NAME}` syntax in configuration values. On startup, these are replaced with the corresponding environment variable values.

```bash
export DB_PASSWORD="my_secret_password"
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export JAGAD_MASTER_KEY="my-encryption-master-key"

jagad daemon --config jagad.yaml
```

## Configuration via CLI Flags

All configuration options are also available as command-line flags for one-shot operations:

```bash
jagad backup \
  --db-type postgresql \
  --db-host localhost \
  --db-port 5432 \
  --db-user jagad \
  --db-password "${DB_PASSWORD}" \
  --db-name myapp_production \
  --storage-endpoint https://s3.us-east-1.amazonaws.com \
  --storage-region us-east-1 \
  --storage-bucket my-backups \
  --storage-access-key "${AWS_ACCESS_KEY_ID}" \
  --storage-secret-key "${AWS_SECRET_ACCESS_KEY}"
```

## Configuration Validation

You can validate your configuration file without running any backups:

```bash
jagad validate --config jagad.yaml
```

This checks:
- All required fields are present
- Connection references are valid
- Storage provider references are valid
- Cron expressions are parseable
- No circular dependencies
