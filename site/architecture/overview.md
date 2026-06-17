---
title: 'Architecture Overview'
---

# Architecture Overview

Jagad is a self-hosted database backup manager with a modular architecture designed around streaming pipelines, pluggable storage backends, and cron-based scheduling. This document describes the high-level system architecture, component interactions, data flow, and technology choices.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Docker / Host                              │
│                                                                     │
│  ┌──────────────────┐     ┌──────────────────────────────────────┐  │
│  │   Nginx / UI      │     │          Go Backend (API)            │  │
│  │   (Port 8085)     │────▶│                                      │  │
│  │   Static SPA      │     │  ┌────────┐ ┌──────────┐ ┌───────┐  │  │
│  └──────────────────┘     │  │ Router │ │   Auth   │ │ Config│  │  │
│                           │  └────────┘ └──────────┘ └───────┘  │  │
│                           │                                      │  │
│                           │  ┌──────────┐ ┌─────────────────┐   │  │
│                           │  │ Scheduler│ │  Backup Engine   │   │  │
│                           │  │ (cron)   │ │  (Streaming      │   │  │
│                           │  └──────────┘ │   Pipeline)      │   │  │
│                           │               └─────────────────┘   │  │
│                           │                                      │  │
│                           │  ┌──────────┐ ┌─────────────────┐   │  │
│                           │  │ Restore  │ │  Notification   │   │  │
│                           │  │ Engine   │ │  (Telegram/     │   │  │
│                           │  └──────────┘ │   Discord/Slack)│   │  │
│                           │               └─────────────────┘   │  │
│                           │                                      │  │
│                           │  ┌──────────────────────────────┐   │  │
│                           │  │       SQLite Database         │   │  │
│                           │  │  (config, history, metadata)  │   │  │
│                           │  └──────────────────────────────┘   │  │
│                           └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
     ┌────▼────┐             ┌──────▼──────┐          ┌──────▼──────┐
     │   S3     │             │  Cloudflare  │          │    MinIO    │
     │  (AWS)   │             │    R2        │          │  (Self-     │
     └─────────┘             └─────────────┘          │   Hosted)   │
                                                      └─────────────┘
          │                         │                         │
     ┌────▼────┐             ┌──────▼──────┐          ┌──────▼──────┐
     │Backblaze│             │DigitalOcean  │          │  Google     │
     │   B2    │             │   Spaces     │          │   Cloud     │
     └─────────┘             └─────────────┘          └─────────────┘
```

---

## Core Components

### 1. CLI / Web UI (Frontend)

The frontend is a **Vanilla JavaScript SPA** served by Nginx. It communicates with the Go backend via a RESTful JSON API. No build step or framework is required — the UI is purely static HTML/CSS/JS with dynamic content loading.

**Features:**
- Dashboard with real-time backup metrics and status
- Connection management (add/test/edit/delete database connections)
- Storage provider configuration (S3/R2/MinIO/B2)
- Schedule management with cron expression builder
- Backup history with search, filtering, and log viewing
- Restore workflow with target selection
- Dark/light theme toggle
- Mobile-responsive sidebar navigation

**Key UI libraries:**
- [Lucide Icons](https://lucide.dev/) — SVG icon set
- Custom CSS with CSS custom properties for theming
- `fetch()`-based API calls with no external JS dependencies

### 2. Go Backend (API Server)

The backend is a single Go binary that serves the REST API, manages the scheduler, and executes backups. It uses the standard library `net/http` with Go 1.22+ routing patterns.

**Internal packages:**

| Package | Responsibility |
|---|---|
| `cmd/jagad` | Main entrypoint, dependency injection |
| `internal/api` | HTTP router, middleware, response helpers |
| `internal/auth` | Session-based authentication (cookie + header) |
| `internal/config` | Environment variable configuration |
| `internal/backup` | Backup execution engine, incremental engine registry |
| `internal/restore` | Restore engine (download → decrypt → decompress → pipe to DB) |
| `internal/schedule` | Cron scheduler (robfig/cron v3) |
| `internal/connection` | Database connection management (PG/MySQL/MariaDB) |
| `internal/storage` | S3-compatible storage abstraction & provider management |
| `internal/encryption` | AES-256-GCM encryption with streaming support |
| `internal/notification` | Multi-channel notifications (Telegram, Discord, Slack) |
| `internal/repository` | SQLite data access layer |
| `internal/httputil` | Shared HTTP utilities |

### 3. Backup Engine

The backup engine is the heart of the system. It supports two backup modes:

- **Full backup:** Uses native dump tools (`pg_dump`, `mysqldump`, `mariadb-dump`) with a streaming pipeline that pipes stdout through compression and encryption directly to S3 — no disk buffer required.
- **Incremental backup:** Uses mature third-party tools integrated as pluggable engines (pgBackRest, Percona XtraBackup, Mariabackup) with WAL-based or page-level change tracking.

The engine enforces a **concurrency limit** (max 3 simultaneous backups via a buffered channel semaphore) to prevent resource exhaustion.

### 4. Scheduler

The scheduler wraps `robfig/cron/v3` and persists schedules in SQLite. On startup, it loads all enabled schedules and registers them with the cron engine. Key responsibilities:

- Parse cron expressions and schedule backup execution
- Support manual "run now" for any schedule
- Enforce retention policies after each scheduled backup (delete oldest backups beyond the configured count)
- Track next-run times for display in the UI

### 5. Notification System

The notification service supports multi-channel alerts for backup results:

| Channel | Method | Configuration |
|---|---|---|
| Telegram | Bot API (`sendMessage`) | Bot token + Chat ID |
| Discord | Webhook | Webhook URL |
| Slack | Webhook | Webhook URL |

Each schedule can specify which notification targets to use, and whether to notify on success, failure, or both. Messages include database name, type, size, duration, status emoji, and a truncated log tail.

---

## Data Flow

### Full Backup Flow

```
User/UI ──▶ API ──▶ Backup Service ──▶ runFullBackup()
                                              │
                                    ┌─────────▼─────────┐
                                    │  Resolve Storage   │
                                    │  Provider          │
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  pg_dump/mysqldump │
                                    │  (stdout pipe)     │
                                    └─────────┬─────────┘
                                              │ stdout
                                    ┌─────────▼─────────┐
                                    │  Streaming Pipeline │
                                    │                     │
                                    │  raw dump ──▶ gzip  │
                                    │       ──▶ encrypt   │
                                    │       ──▶ S3 upload │
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  SHA-256 Checksum  │
                                    │  (of compressed    │
                                    │   data, pre-encrypt)│
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Persist Backup    │
                                    │  Record in SQLite  │
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Notify Success/   │
                                    │  Failure           │
                                    └───────────────────┘
```

### scheduled Backup Flow

```
Cron triggers ──▶ Scheduler ──▶ executeBackup()
                                      │
                            ┌─────────▼─────────┐
                            │  StartBackup()     │
                            │  (same path as     │
                            │   manual)          │
                            └─────────┬─────────┘
                                      │
                            ┌─────────▼─────────┐
                            │  EnforceRetention()│
                            │  - List oldest     │
                            │  - Delete excess   │
                            │  - Remove from S3  │
                            └───────────────────┘
```

### Restore Flow

```
User/UI ──▶ API ──▶ Restore Service ──▶ runRestore()
                                                │
                                      ┌─────────▼─────────┐
                                      │  Download from S3  │
                                      │  (full file into   │
                                      │   memory)          │
                                      └─────────┬─────────┘
                                                │
                                      ┌─────────▼─────────┐
                                      │  Decrypt (AES-256- │
                                      │  GCM) if encrypted │
                                      └─────────┬─────────┘
                                                │
                                      ┌─────────▼─────────┐
                                      │  Decompress (gzip) │
                                      └─────────┬─────────┘
                                                │
                                      ┌─────────▼─────────┐
                                      │  Pipe to restore   │
                                      │  command (pg_restore│
                                      │  / mysql)          │
                                      └───────────────────┘
```

> **Note:** The restore pipeline currently loads the full backup into memory. For very large databases, future work may add a streaming restore path.

---

## Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Backend** | Go | 1.25+ (standard library `net/http`, Go 1.22+ routing) |
| **Database** | SQLite | via `modernc.org/sqlite` (pure Go, no CGO) |
| **Frontend** | Vanilla JavaScript SPA | No framework, Lucide Icons, CSS custom properties |
| **Scheduler** | `github.com/robfig/cron/v3` | Standard cron expressions |
| **Storage SDK** | `github.com/minio/minio-go/v7` | S3-compatible object storage client |
| **Encryption** | AES-256-GCM | `crypto/aes` + `crypto/cipher` + Argon2id KDF |
| **Container** | Docker / Docker Compose | Multi-stage Dockerfile for backend + Nginx for frontend |
| **CI/CD** | GitHub Actions | (planned) |

### Why These Choices?

- **Go:** Excellent standard library, built-in concurrency (goroutines, channels), cross-compilation, single binary deployment, and strong ecosystem for cloud/CLI tools.
- **SQLite:** Zero-operation database that requires no server process. Perfect for single-instance backup managers. Embedded directly in the Go binary via pure-Go driver.
- **MinIO SDK:** Mature, widely-adopted S3 client that works with any S3-compatible service (AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces, Google Cloud Storage).
- **Vanilla JS SPA:** No build step, no framework churn, maximum compatibility. The UI is simple enough that a framework would add unnecessary complexity.
- **AES-256-GCM:** Industry-standard authenticated encryption. GCM mode provides both confidentiality and integrity verification in a single pass.

---

## Key Design Decisions

### No Disk Buffer for Full Backups
Full backups stream directly from the database dump tool through compression and encryption to S3 without writing to disk. This means:
- **Unlimited database sizes:** A 1 TB database uses the same ~64 KB of memory as a 1 MB database
- **No disk space contention:** The backup doesn't compete with the database for disk I/O
- **No cleanup needed:** No temp files to delete on success or failure

### Encrypted Storage Provider Credentials
S3 access keys and secrets are encrypted at rest in SQLite using AES-256-GCM with a SHA-256 derived key. The master key is provided via the `JAGAD_MASTER_KEY` environment variable.

### Concurrent Backup Limiting
A buffered channel semaphore limits concurrent backups to 3 by default (configurable via `JAGAD_MAX_CONCURRENT`). This prevents overwhelming the host system when multiple schedules trigger simultaneously.

### Pluggable Incremental Engine Architecture
The `IncrementalEngine` interface abstracts database-specific incremental backup tools behind a common contract:

```go
type IncrementalEngine interface {
    DBType() string
    BackupFull(sch IncrementalSchedule, conn *connection.Connection, backupID string) (map[string]string, error)
    BackupIncremental(sch IncrementalSchedule, conn *connection.Connection, backupID string) (map[string]string, error)
}
```

This allows adding support for new databases or replacing the underlying tool without changing the core backup logic.

---

## Component Interaction Diagram

```
┌──────────────┐     HTTP/JSON      ┌──────────────────┐
│   Web UI     │◄──────────────────►│    API Handler    │
│  (Browser)   │                    │  (internal/api)   │
└──────────────┘                    └────────┬─────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
              ┌─────▼─────┐         ┌───────▼───────┐      ┌──────▼──────┐
              │    Auth    │         │    Backup     │      │   Restore   │
              │  Service   │         │   Service     │      │   Service   │
              └─────┬─────┘         └───────┬───────┘      └──────┬──────┘
                    │                       │                      │
              ┌─────▼─────┐         ┌───────▼───────┐      ┌──────▼──────┐
              │  SQLite    │         │  Encryption   │      │   Storage   │
              │ Repository │         │   Service     │      │   Service   │
              └───────────┘         └───────┬───────┘      └──────┬──────┘
                                            │                      │
                                    ┌───────▼───────┐      ┌──────▼──────┐
                                    │   S3 Client   │      │  S3 Client  │
                                    │  (MinIO SDK)  │      │ (MinIO SDK) │
                                    └───────────────┘      └─────────────┘
```

---

## Database Schema (SQLite)

The SQLite database stores all persistent state:

| Table | Purpose |
|---|---|
| `connections` | Database server connections (host, port, credentials) |
| `connection_databases` | Auto-discovered databases on each server |
| `backups` | Backup records (status, storage path, checksum, size, logs) |
| `schedules` | Cron schedules with retention policy |
| `restores` | Restore operation records |
| `storage_providers` | S3-compatible storage configurations |
| `notification_targets` | Notification channel configurations |
| `settings` | Application settings (theme, etc.) |

---

## Related

- [Streaming Pipeline](./streaming-pipeline) — Deep dive into the io.Pipe-based streaming architecture
- [Incremental Backup](./incremental-backup) — WAL archiving and page-level incremental backup
- [Security Model](./security) — Encryption, key management, and authentication
