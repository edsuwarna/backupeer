---
title: 'CLI Reference'
description: 'All CLI commands and flags: backupeer serve, backup, restore, config, list, log, status'
---

# CLI Reference

Backupeer is a single-binary application that runs as a **web server**. There is no standalone CLI mode for one-off backup/restore operations — all operations are performed through the **REST API** or the **Web UI**.

## Usage

```bash
backupeer [command] [options]
```

## Commands

### `serve` (Default)

Start the Backupeer web server. This is the default command and the primary way to run Backupeer.

```bash
backupeer serve
```

Or simply:

```bash
backupeer
```

**Flags:**

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `--port` (or `-p`) | `BACKUPEER_PORT` | `8080` | HTTP server listen port |
| `--data-dir` | `BACKUPEER_DATA_DIR` | `/data` | Directory for SQLite database and runtime data |
| `--admin-user` | `BACKUPEER_ADMIN_USER` | `admin` | Web UI admin username |
| `--admin-pass` | `BACKUPEER_ADMIN_PASS` | `admin123` | Web UI admin password |
| `--secret-key` | `BACKUPEER_SECRET_KEY` | Auto-generated | Session signing secret key |
| `--encryption-key` | `BACKUPEER_ENCRYPTION_KEY` | (empty) | AES-256-GCM backup encryption key (enables encryption) |
| `--master-key` | `BACKUPEER_MASTER_KEY` | (empty) | Master key for credential encryption at rest |
| `--s3-endpoint` | `BACKUPEER_S3_ENDPOINT` | (empty) | S3-compatible storage endpoint (legacy config) |
| `--s3-region` | `BACKUPEER_S3_REGION` | `auto` | S3 region (legacy config) |
| `--s3-bucket` | `BACKUPEER_S3_BUCKET` | `backups` | S3 bucket name (legacy config) |
| `--s3-access-key` | `BACKUPEER_S3_ACCESS_KEY` | (empty) | S3 access key (legacy config) |
| `--s3-secret-key` | `BACKUPEER_S3_SECRET_KEY` | (empty) | S3 secret key (legacy config) |
| `--s3-path-style` | `BACKUPEER_S3_PATH_STYLE` | `true` | Use path-style S3 URL (vs virtual-hosted) |
| `--max-concurrent` | `BACKUPEER_MAX_CONCURRENT` | `3` | Maximum concurrent backup operations |
| `--version` | — | — | Print version and exit |

**Example:**

```bash
# Start with encryption and custom port
backupeer --port 9090 \
  --encryption-key "$(cat /etc/backupeer/encryption.key)" \
  --master-key "$(cat /etc/backupeer/master.key)" \
  --data-dir /var/lib/backupeer
```

### `version`

Print the Backupeer version and exit.

```bash
backupeer version
```

## Configuration Priority

Backupeer reads configuration in the following order (later overrides earlier):

1. **Default values** (compiled into the binary)
2. **Environment variables** (backupeer_*)
3. **Command-line flags** (highest priority)

There is no configuration file support in the CLI binary. The **Configuration File** reference describes the file format used by the Web UI settings page, not the startup binary.

## Environment Variables

All CLI flags have corresponding environment variables. Use `BACKUPEER_` prefix:

```bash
export BACKUPEER_PORT=9090
export BACKUPEER_ENCRYPTION_KEY="my-encryption-key"
export BACKUPEER_MASTER_KEY="my-master-key"
export BACKUPEER_S3_ENDPOINT="https://s3.amazonaws.com"
export BACKUPEER_S3_BUCKET="my-backups"
export BACKUPEER_S3_ACCESS_KEY="AKIA..."
export BACKUPEER_S3_SECRET_KEY="..."
export BACKUPEER_S3_PATH_STYLE=false
export BACKUPEER_MAX_CONCURRENT=5
backupeer
```

## Required Tools

Backupeer checks for required database tools on startup and logs warnings if any are missing:

| Tool | Provides | Required For |
|------|----------|-------------|
| `pg_dump` | PostgreSQL full backup | PostgreSQL full backups |
| `pg_restore` | PostgreSQL restore | PostgreSQL restores |
| `mysqldump` | MySQL/MariaDB full backup | MySQL full backups |
| `mysql` | MySQL restore | MySQL restores |
| `mariadb-dump` | MariaDB full backup | MariaDB full backups (preferred) |
| `mariadb` | MariaDB restore | MariaDB restores (preferred) |
| `pgbackrest` | PostgreSQL incremental | PostgreSQL incremental backups |
| `xtrabackup` | MySQL incremental | MySQL incremental backups |
| `mariabackup` | MariaDB incremental | MariaDB incremental backups |

Missing tools do not prevent Backupeer from starting — they only affect the corresponding functionality.

## Upcoming CLI Commands

The following CLI commands are planned for future releases:

- `backupeer backup` — Run a backup from the command line (for scripting)
- `backupeer restore` — Restore a backup from the command line
- `backupeer list` — List backups
- `backupeer config` — View/edit configuration
- `backupeer log` — View backup logs
- `backupeer status` — Show server/backup status

Currently, these operations are available via the **REST API** and **Web UI**.
