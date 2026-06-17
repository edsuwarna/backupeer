---
title: 'What is Jagad?'
description: 'Overview of the Jagad database backup tool — the problem it solves, key features, and target audience.'
---

# What is Jagad?

Jagad is an **open-source database backup tool** written in Go that streams database backups directly to S3/R2-compatible object storage with zero disk overhead. It supports PostgreSQL, MySQL, and MariaDB.

Unlike traditional backup tools that dump to disk or buffer in memory, Jagad uses a pure streaming pipeline architecture — `pg_dump stdout → gzip → encrypt → S3` — connected via `io.Pipe` chains that consume approximately **64KB of memory** regardless of database size.

## The Problem

Database backups are critical infrastructure, yet most tools suffer from one or more of these problems:

- **Disk space contention** — backups are written to local disk before being uploaded, competing with production data
- **Memory blowup** — large databases OOM the backup process when buffered in memory
- **Complex configuration** — stitching together `pg_dump`, `gzip`, `openssl`, and `s3cmd` with shell scripts
- **No retention management** — cleaning up old backups is manual or requires separate cron jobs
- **No notifications** — backup failures go unnoticed until it's too late
- **No unified interface** — different databases need different tools with different config formats

## How Jagad Solves It

Jagad addresses all of these problems in a single binary with a Stripe-inspired web UI:

| Problem | Solution |
|----------|----------|
| Disk contention | Pure streaming pipeline — no temp files, no disk spooling |
| Memory blowup | ~64KB peak memory via `io.Pipe` chains |
| Complex config | Single YAML config file or manage via Web UI |
| Retention | Automatic tiered retention (hourly/daily/weekly/monthly) |
| Notifications | Multi-channel: Telegram, Discord, Slack, email, webhooks |
| Multiple DBs | Unified interface for PostgreSQL, MySQL, MariaDB |

## Key Features

### Streaming Pipeline
Process databases of any size with just ~64KB memory. The dump output streams directly through compression (gzip) and optional encryption (AES-256-GCM) to S3 multipart upload. No temp files, no arbitrary size limits, no OOM risk.

### Multiple Database Support
- **PostgreSQL** — uses `pg_dump` for full backups, WAL-based via pgBackRest for incremental
- **MySQL** — uses `mysqldump` for full backups, page-level via Percona XtraBackup for incremental
- **MariaDB** — uses `mariadb-dump` / `mysqldump` for full backups, page-level via Mariabackup for incremental

### Full & Incremental Backups
Choose between full logical dumps or fast incremental backups. Incremental backups use database-native tools (pgBackRest, Percona XtraBackup, Mariabackup) for page-level change tracking. Jagad orchestrates them through a unified interface.

### AES-256-GCM Encryption
End-to-end encryption with streaming chunk-level framing. Uses Argon2id key derivation from a master key. Counter-based nonces ensure each chunk uses a unique nonce. Authentication tags and proper EOF marking guarantee integrity.

### S3 & R2 Object Storage
Any S3-compatible object storage — AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2, Google Cloud Storage. Backups are uploaded as multipart uploads for reliability with large data.

### Cron-Based Scheduling
Define backup schedules using standard cron expressions. Jagad automatically enforces retention policies after each backup, deleting old backups that exceed configured limits.

### Multi-Channel Notifications
Get notified on backup success, failure, or warnings via Telegram, Discord, Slack, email, or custom webhooks. Notification messages include database name, size, duration, and log excerpts.

### Beautiful Web UI
Stripe-inspired dashboard with real-time metrics, backup history, schedule management, connection configuration, and restore workflows. Primary color: `#635BFF`.

### Concurrent Backup Execution
Run up to 3 backups concurrently with built-in semaphore limiting. Each backup runs in its own goroutine with a dedicated streaming pipeline.

## Target Audience

Jagad is built for:

- **DevOps engineers** who need reliable, automated database backups with minimal infrastructure
- **System administrators** managing multiple database servers across PostgreSQL, MySQL, and MariaDB
- **Startups and small teams** who want production-grade backups without enterprise tooling costs
- **Platform engineers** building internal database-as-a-service platforms
- **Self-hosters** who want encrypted, off-site backups for their personal projects

## License

Jagad is released under the **Apache 2.0 License** — free to use, modify, and distribute.
