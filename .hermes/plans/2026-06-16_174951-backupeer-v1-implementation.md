# Backupeer — v1 Implementation Plan

**Date:** 2026-06-16  
**Status:** ✅ Phase 1-5 Complete  
**Target:** v1.0 Release

---

## 1. Current State

Backupeer is a **fully functional** self-hosted database backup manager with Web UI, serving PostgreSQL, MySQL, and MariaDB.

### Deployed
- Running at `localhost:8085` via Docker Compose
- SQLite backend (`backupeer.db` in data dir)
- Vanilla JS SPA frontend (no framework)

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                   nginx (:8085)                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Go Web Server (backupeer-backend)              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│ │
│  │  │ Auth     │ │ API      │ │ Scheduler        ││ │
│  │  │ Service  │ │ Router   │ │ (robfig/cron)    ││ │
│  │  └──────────┘ └──────────┘ └──────────────────┘│ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│ │
│  │  │ Backup   │ │ Connection│ │ Restore          ││ │
│  │  │ Service  │ │ Service  │ │ Service          ││ │
│  │  └──────────┘ └──────────┘ └──────────────────┘│ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│ │
│  │  │ Storage  │ │Encryption│ │ Retention        ││ │
│  │  │ Service  │ │Service   │ │ Enforcer         ││ │
│  │  └──────────┘ └──────────┘ └──────────────────┘│ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │  SQLite (backups, connections, schedules, ...)  │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │  S3 / R2 / MinIO (backup storage)              │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 3. What's Implemented

### Backend (Go)

| Package | Files | Status |
|---|---|---|
| `cmd/backupeer/` | `main.go` | ✅ Graceful shutdown, tool check |
| `internal/api/` | `router.go`, `response.go` | ✅ Route composition |
| `internal/auth/` | `service.go` | ✅ Cookie + header auth |
| `internal/backup/` | `handler.go`, `service.go`, `model.go` | ✅ CRUD, download, verify, stats, retention |
| `internal/connection/` | `handler.go`, `service.go`, `model.go` | ✅ CRUD + DB discovery |
| `internal/storage/` | `s3.go`, `crypto.go`, `provider.go`, `provider_service.go`, `provider_handler.go` | ✅ S3 client + credential encryption |
| `internal/encryption/` | `service.go` | ✅ AES-256-GCM backup encryption |
| `internal/restore/` | `handler.go`, `service.go`, `model.go` | ✅ Full restore (PG/MySQL/MariaDB) |
| `internal/schedule/` | `handler.go`, `service.go`, `model.go`, `scheduler.go` | ✅ Cron + retention hook |
| `internal/repository/` | `db.go`, `backup.go`, `connection.go`, `restore.go`, `schedule.go`, `storage_provider.go` | ✅ SQLite impl |
| `internal/config/` | `config.go` | ✅ Env-based config |
| `internal/httputil/` | `response.go` | ✅ JSON helpers |
| `prd/` | `PRD.md`, `README.md`, `tracking.md` | ✅ PRD + tracking |

### Frontend (Vanilla JS SPA)

| Page | File Lines | Features |
|---|---|---|
| Dashboard | 262-376 | Stats, recent backups, hero |
| Connections | 381-545 | CRUD, discover, backup trigger |
| Backups | 550-686 | List, download, verify, restore, delete, logs |
| Schedules | 691-864 | CRUD, toggle, run-now, retention config |
| Storage | 869-1117 | CRUD, test, set-default |
| Settings | 1122-1163 | Theme, encryption status |
| Shared | 214-238 | Modal system |

### API Endpoints (26 total)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/check` | Session check |
| `GET` | `/api/health` | Health + version |
| `GET/POST` | `/api/connections` | List / Create |
| `GET/PUT/DELETE` | `/api/connections/{id}` | Get / Update / Delete |
| `POST` | `/api/connections/{id}/discover` | DB discovery |
| `GET/POST` | `/api/backups` | List / Create |
| `GET/DELETE` | `/api/backups/{id}` | Get / Delete |
| `GET` | `/api/backups/{id}/logs` | Backup logs |
| `GET` | `/api/backups/{id}/download` | **Download backup** (NEW) |
| `POST` | `/api/backups/{id}/verify` | **Verify integrity** (NEW) |
| `GET` | `/api/backups/stats` | **Aggregate stats** (NEW) |
| `POST` | `/api/backups/{id}/restore` | Restore backup |
| `GET` | `/api/restores` | List restores |
| `GET` | `/api/restores/{id}` | Restore detail |
| `GET/POST/PUT/DELETE` | `/api/schedules` | Schedule CRUD |
| `POST` | `/api/schedules/{id}/run` | Run now |
| `GET/POST/PUT/DELETE` | `/api/storage-providers` | Provider CRUD |
| `POST` | `/api/storage-providers/{id}/test` | Test connection |
| `POST` | `/api/storage-providers/{id}/set-default` | Set default |

---

## 4. What's Missing / Gaps

### 🔴 Critical Gaps

| Gap | Impact | Effort |
|---|---|---|
| **Incremental chain restore** | Incremental backup tanpa chain restore = meaningless | Medium |
| **Real incremental engine** | Current "incremental" is just a label — still uses pg_dump/mysqldump | Large |
| **Download from nginx** | Large downloads might timeout behind Go HTTP server | Small |

### 🟡 Important

| Gap | Impact | Effort |
|---|---|---|
| **CI/CD (GitHub Actions)** | No auto-build + push to GHCR | Small |
| **README.md** | No quick start guide | Small |
| **License file** | No Apache 2.0 yet | Tiny |
| **SSL/TLS** | Currently plain HTTP behind nginx | Small |
| **Error handling polish** | Some raw 500s in edge cases | Medium |
| **SSE log streaming** | Currently polling-based log viewer | Medium |
| **Backup in-progress status UI** | No real-time progress indicator | Small |

### ⚪ Nice-to-Have

| Feature | Notes |
|---|---|
| Notification integrations | Email, Telegram, Slack |
| Schedule templates | Preset cron expressions |
| Schedule next-run display | Show upcoming execution time |
| Config export/import | JSON dump of connections + schedules |
| Database stats | Storage usage per DB in dashboard |
| Pagination for backup list | Currently limited to 100 |

---

## 5. Database Schema

7 tables: `connections`, `connection_databases`, `storage_providers`, `schedules`, `backups`, `restores`, `encryption_keys`

All auto-created via `repository/db.go` `migrate()` function.

### Key Relationships
- `connections` 1—N `connection_databases`
- `connections` 1—N `backups`
- `schedules` 1—N `backups`
- `storage_providers` 1—N `backups`
- `backups` 1—N `restores`

---

## 6. Configuration

| Env Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `DATA_DIR` | `./data` | SQLite storage path |
| `ADMIN_USER` | `admin` | Login username |
| `ADMIN_PASS` | `admin123` | Login password |
| `SECRET_KEY` | Auto-generated | Session signing key |
| `MASTER_KEY` | `backupeer-master-key` | Credential encryption key |
| `ENCRYPTION_KEY` | empty | Backup AES-256-GCM key |
| `STORAGE_ENDPOINT` | empty | Legacy S3 endpoint |
| `STORAGE_REGION` | `auto` | Legacy S3 region |
| `STORAGE_BUCKET` | empty | Legacy S3 bucket |
| `STORAGE_ACCESS_KEY` | empty | Legacy S3 access key |
| `STORAGE_SECRET_KEY` | empty | Legacy S3 secret key |
| `STORAGE_PATH_STYLE` | `true` | Legacy S3 path style |

---

## 7. Deployment

```
git clone https://github.com/edsuwarna/backupeer
cd backupeer
docker compose up -d
# → http://localhost:8085
```

Default login: `admin` / `admin123`

### Docker Images
- Backend: built locally via `Dockerfile` (Alpine + Go multi-stage)
- Frontend: nginx serving static files via `Dockerfile.frontend`
- Images tagged as `ghcr.io/edsuwarna/backupeer-backend` and `ghcr.io/edsuwarna/backupeer-frontend`

---

## 8. Next Steps

### Immediate (pre-v1.0)
1. Write README.md — quick start + screenshots
2. Add Apache 2.0 LICENSE
3. Set up GitHub Actions: build + push to GHCR
4. Add `next_run` info to schedule list response

### v1.1
1. Percona XtraBackup integration for real MySQL incremental
2. pgBackRest integration for real PG WAL-based incremental
3. Incremental chain restore
4. SSE log streaming during backup/restore

### v1.2
1. Notification integrations (Telegram, Email)
2. Config export/import
3. Schedule templates

---

## 9. Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| **SQLite concurrency** | Single writer mode (`MaxOpenConns=1`) — OK for single-user |
| **Large backup download RAM** | Streams directly from S3 → client, no buffering |
| **Backup encryption key in env** | Document best practice: use Docker secrets |
| **No health monitoring** | Health endpoint + Docker restart policy |
| **Credential encryption key** | Falls back to default if `MASTER_KEY` not set — weak |

---

## 10. Verification Checklist

After deployment:
- [x] `GET /api/health` returns 200
- [x] Login works with admin/admin123
- [x] Create storage provider (S3/R2/MinIO)
- [x] Create connection (PG/MySQL/MariaDB)
- [x] Discover databases
- [x] Run full backup → status "success"
- [x] Download backup file
- [x] Verify backup checksum
- [x] Restore backup
- [x] Create schedule with retention
- [x] Schedule fires + retention enforces
- [x] Dark/light mode toggle works
- [x] Log viewer shows backup details
