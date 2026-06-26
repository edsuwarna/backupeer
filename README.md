# Jagad

> **Backup Manager** — Web UI untuk PostgreSQL, MySQL, dan MariaDB backup dengan S3-compatible object storage.

[![Build](https://github.com/edsuwarna/jagad/actions/workflows/build-push.yml/badge.svg)](https://github.com/edsuwarna/jagad/actions/workflows/build-push.yml)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-green)
![Go](https://img.shields.io/badge/Go-1.25-blue)

---

## Overview

Jagad adalah **self-hosted database backup manager** dengan Web UI yang memungkinkan kamu mengelola backup database dari satu dashboard. Support full backup, scheduled backup dengan retention policy, dan S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Backblaze B2).

### Key Features

- **🛢️ Multi-DB** — PostgreSQL, MySQL, MariaDB
- **⏰ Scheduled Backups** — Cron-based dengan retention policy auto-cleanup
- **☁️ S3-Compatible** — AWS S3, Cloudflare R2, MinIO, Backblaze B2
- **🔐 Encryption at Rest** — AES-256-GCM client-side encryption sebelum upload
- **✅ Backup Verification** — SHA-256 checksum verification
- **⬇️ Download & Restore** — One-click restore atau download backup file
- **📊 Web UI** — Dashboard, backup history, schedule management
- **🌓 Dark/Light Mode** — Theme toggle
- **📱 Responsive** — Mobile-friendly dengan sidebar slide-in

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- PostgreSQL / MySQL / MariaDB server (yang mau di-backup)

### 1. Clone & Run

```bash
git clone https://github.com/edsuwarna/jagad.git
cd jagad
docker compose up -d
```

### 2. Access UI

```
http://localhost:8085
```

**Default credentials:**
- Username: `admin`
- Password: `admin123`

### 3. Add Connection

1. Go to **Connections** → **Add Connection**
2. Choose DB type (PostgreSQL, MySQL, MariaDB)
3. Fill connection details (host, port, user, password)
4. Test connection → Save
5. Backend auto-discovers databases on the server

### 4. Add Storage Provider

1. Go to **Storage** → **Add Storage**
2. Choose type (AWS S3, Cloudflare R2, MinIO, Backblaze B2)
3. Fill endpoint, bucket, credentials
4. Test → Save

### 5. Run Backup

- **Manual:** Click "Run Backup Now" on Dashboard
- **Scheduled:** Go to **Schedules** → **Create Schedule** → Set cron + retention

---

## Architecture

Jagad supports **two database backends**:

| Backend | Use Case |
|---------|----------|
| **SQLite** (default) | Single-server, zero-config — no external dependencies |
| **PostgreSQL + TimescaleDB** | Production, monitoring, multi-server — enables DB health metrics |

When `JAGAD_DATABASE_URL` is set, Jagad uses PostgreSQL with TimescaleDB for both config data AND monitoring hypertables. When unset, it falls back to SQLite.

```
┌──────────────────────────────────────────────────────┐
│                 Docker Compose                        │
│                                                       │
│  ┌──────────────┐     ┌────────────────┐              │
│  │  Nginx (UI)  │────▶│  Go Backend    │              │
│  │  :8085       │     │  :8080         │              │
│  │  web/ static │     │  REST API      │              │
│  └──────────────┘     │  + Scheduler   │              │
│                       │  + Backup Exec │              │
│                       └───────┬────────┘              │
│                              │                        │
│                       ┌──────▼───────┐               │
│                       │  PostgreSQL  │               │
│                       │  +TimescaleDB│               │
│                       │  (or SQLite) │               │
│                       └──────┬───────┘               │
└──────────────────────────────┼───────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                       │
   ┌────▼────┐          ┌─────▼─────┐          ┌──────▼───┐
   │  S3     │          │  R2 / B2  │          │  MinIO   │
   └─────────┘          └───────────┘          └──────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.25 |
| Database | SQLite (default) or PostgreSQL + TimescaleDB |
| Monitoring | TimescaleDB hypertables (health_checks, db_metrics, perf_metrics) |
| Frontend | Vanilla JS SPA + Lucide Icons |
| Scheduler | robfig/cron |
| Storage SDK | MinIO (S3-compatible) |
| Encryption | AES-256-GCM + Argon2id KDF |
| Container | Docker / Docker Compose |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/check` | Check auth status |
| `GET` | `/api/connections` | List connections |
| `POST` | `/api/connections` | Add connection |
| `PUT` | `/api/connections/{id}` | Update connection |
| `DELETE` | `/api/connections/{id}` | Delete connection |
| `POST` | `/api/connections/{id}/test` | Test connection |
| `GET` | `/api/connections/{id}/databases` | List discovered DBs |
| `POST` | `/api/connections/{id}/discover` | Re-discover databases |
| `PUT` | `/api/connections/databases/{id}` | Update DB selection |
| `GET` | `/api/backups` | List backups |
| `POST` | `/api/backups` | Start backup |
| `GET` | `/api/backups/{id}` | Backup detail |
| `DELETE` | `/api/backups/{id}` | Delete backup |
| `GET` | `/api/backups/{id}/logs` | Backup logs |
| `GET` | `/api/backups/{id}/download` | Download backup |
| `POST` | `/api/backups/{id}/verify` | Verify backup |
| `GET` | `/api/backups/stats` | Backup statistics |
| `GET` | `/api/schedules` | List schedules |
| `POST` | `/api/schedules` | Create schedule |
| `PUT` | `/api/schedules/{id}` | Update schedule |
| `DELETE` | `/api/schedules/{id}` | Delete schedule |
| `POST` | `/api/schedules/{id}/run` | Run schedule now |
| `GET` | `/api/restores` | List restores |
| `POST` | `/api/backups/{id}/restore` | Restore from backup |
| `GET` | `/api/restores/{id}` | Restore detail |
| `GET` | `/api/storage-providers` | List storage providers |
| `POST` | `/api/storage-providers` | Add storage provider |
| `PUT` | `/api/storage-providers/{id}` | Update storage |
| `DELETE` | `/api/storage-providers/{id}` | Delete storage |
| `POST` | `/api/storage-providers/{id}/test` | Test storage |
| `POST` | `/api/storage-providers/{id}/set-default` | Set default |
| `GET` | `/api/monitoring/health` | Health check history (PG only) |
| `GET` | `/api/monitoring/metrics` | Database metrics (PG only) |
| `GET` | `/api/monitoring/performance` | Performance metrics (PG only) |

---

## Configuration

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `JAGAD_PORT` | `8080` | API server port |
| `JAGAD_DATA_DIR` | `/data` | SQLite + temp data directory |
| `JAGAD_DATABASE_URL` | *(none)* | PostgreSQL DSN (set to use PG+TimescaleDB instead of SQLite) |
| `JAGAD_ADMIN_USER` | `admin` | Admin username |
| `JAGAD_ADMIN_PASS` | `admin123` | Admin password |
| `JAGAD_SECRET_KEY` | *(auto)* | Session secret key |
| `JAGAD_ENCRYPTION_KEY` | *(none)* | Master key for AES-256-GCM |

## Migration from SQLite to PostgreSQL

To migrate existing data from SQLite to PostgreSQL:

```bash
# 1. Start TimescaleDB + migrate data
docker compose up -d timescaledb
go run cmd/migrate-sqlite/main.go \
  -dsn "postgres://postgres:jagad_secret@localhost:5432/jagad?sslmode=disable" \
  -data-dir /path/to/your/data

# 2. Dry-run first to see what will be migrated
go run cmd/migrate-sqlite/main.go \
  -dsn "postgres://postgres:jagad_secret@localhost:5432/jagad?sslmode=disable" \
  -data-dir /path/to/your/data \
  -dry-run

# 3. Set env and restart
export JAGAD_DATABASE_URL="postgres://postgres:jagad_secret@localhost:5432/jagad?sslmode=disable"
docker compose up -d
```

---

## Development

```bash
# Run locally
make run

# Run tests
make test

# Build
make build

# Docker
make docker-run
```

### Project Structure

```
jagad/
├── cmd/jagad/            # Main entrypoint
├── internal/
│   ├── api/             # HTTP router + response helpers
│   ├── auth/            # Authentication
│   ├── backup/          # Backup engine + handler
│   ├── config/          # Configuration
│   ├── connection/      # DB connection management
│   ├── encryption/      # AES-256-GCM encryption
│   ├── repository/      # SQLite data access
│   ├── restore/         # Restore engine
│   ├── schedule/        # Cron scheduler
│   └── storage/         # S3-compatible storage
├── web/                 # Frontend (Vanilla JS SPA)
│   ├── css/style.css
│   ├── js/app.js
│   └── index.html
├── prd/                 # Product requirements
├── sketches/            # UI mockups
├── Dockerfile           # Go backend
├── Dockerfile.frontend  # Nginx frontend
├── docker-compose.yml
└── Makefile
```

---

## Roadmap

- [x] Phase 1: Foundation (Go, SQLite, Auth, Docker)
- [x] Phase 2: Backup Engine (Full backup, S3 storage, encryption)
- [x] Phase 3: Scheduling & Restore (Cron, retention, restore)
- [x] Phase 4: UI MVP (Dashboard, connections, schedules, dark/light)
- [x] Phase 5: PostgreSQL + TimescaleDB (Config & monitoring in single DB)
- [x] Phase 6: Monitoring API (Health checks, DB metrics, performance)
- [ ] v1.1: Incremental backup engine (pgBackRest, XtraBackup, Mariabackup)
- [ ] v1.2: Notifications (Email, Telegram, Slack)
- [ ] v2.0: Multi-user, schedule templates, compression settings

---

## License

Apache 2.0 © 2026 Endang Suwarna
