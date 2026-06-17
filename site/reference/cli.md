---
title: 'CLI Reference'
description: 'All CLI commands and flags: jagad serve, backup, restore, config, list, log, status'
---

# CLI Reference

Jagad is a single-binary application that runs as a **web server**. There is no standalone CLI mode for one-off backup/restore operations — all operations are performed through the **REST API** or the **Web UI**.

## Usage

```bash
jagad [command] [options]
```

## Commands

### `serve` (Default)

Start the Jagad web server. This is the default command and the primary way to run Jagad.

```bash
jagad serve
```

Or simply:

```bash
jagad
```

**Flags:**

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `--port` (or `-p`) | `JAGAD_PORT` | `8080` | HTTP server listen port |
| `--data-dir` | `JAGAD_DATA_DIR` | `/data` | Directory for SQLite database and runtime data |
| `--admin-user` | `JAGAD_ADMIN_USER` | `admin` | Web UI admin username |
| `--admin-pass` | `JAGAD_ADMIN_PASS` | `admin123` | Web UI admin password |
| `--secret-key` | `JAGAD_SECRET_KEY` | Auto-generated | Session signing secret key |
| `--encryption-key` | `JAGAD_ENCRYPTION_KEY` | (empty) | AES-256-GCM backup encryption key (enables encryption) |
| `--master-key` | `JAGAD_MASTER_KEY` | (empty) | Master key for credential encryption at rest |
| `--s3-endpoint` | `JAGAD_S3_ENDPOINT` | (empty) | S3-compatible storage endpoint (legacy config) |
| `--s3-region` | `JAGAD_S3_REGION` | `auto` | S3 region (legacy config) |
| `--s3-bucket` | `JAGAD_S3_BUCKET` | `backups` | S3 bucket name (legacy config) |
| `--s3-access-key` | `JAGAD_S3_ACCESS_KEY` | (empty) | S3 access key (legacy config) |
| `--s3-secret-key` | `JAGAD_S3_SECRET_KEY` | (empty) | S3 secret key (legacy config) |
| `--s3-path-style` | `JAGAD_S3_PATH_STYLE` | `true` | Use path-style S3 URL (vs virtual-hosted) |
| `--max-concurrent` | `JAGAD_MAX_CONCURRENT` | `3` | Maximum concurrent backup operations |
| `--version` | — | — | Print version and exit |

**Example:**

```bash
# Start with encryption and custom port
jagad --port 9090 \
  --encryption-key "$(cat /etc/jagad/encryption.key)" \
  --master-key "$(cat /etc/jagad/master.key)" \
  --data-dir /var/lib/jagad
```

### `version`

Print the Jagad version and exit.

```bash
jagad version
```

## Configuration Priority

Jagad reads configuration in the following order (later overrides earlier):

1. **Default values** (compiled into the binary)
2. **Environment variables** (jagad_*)
3. **Command-line flags** (highest priority)

There is no configuration file support in the CLI binary. The **Configuration File** reference describes the file format used by the Web UI settings page, not the startup binary.

## Environment Variables

All CLI flags have corresponding environment variables. Use `JAGAD_` prefix:

```bash
export JAGAD_PORT=9090
export JAGAD_ENCRYPTION_KEY="my-encryption-key"
export JAGAD_MASTER_KEY="my-master-key"
export JAGAD_S3_ENDPOINT="https://s3.amazonaws.com"
export JAGAD_S3_BUCKET="my-backups"
export JAGAD_S3_ACCESS_KEY="AKIA..."
export JAGAD_S3_SECRET_KEY="..."
export JAGAD_S3_PATH_STYLE=false
export JAGAD_MAX_CONCURRENT=5
jagad
```

## Required Tools

Jagad checks for required database tools on startup and logs warnings if any are missing:

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

Missing tools do not prevent Jagad from starting — they only affect the corresponding functionality.

## Upcoming CLI Commands

The following CLI commands are planned for future releases:

- `jagad backup` — Run a backup from the command line (for scripting)
- `jagad restore` — Restore a backup from the command line
- `jagad list` — List backups
- `jagad config` — View/edit configuration
- `jagad log` — View backup logs
- `jagad status` — Show server/backup status

Currently, these operations are available via the **REST API** and **Web UI**.
