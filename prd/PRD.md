# Backupeer — Product Requirements Document

**Status:** Draft v1  
**Date:** 2026-06-16  
**Author:** Endang Suwarna  

---

## 1. Executive Summary

### Problem
Sysadmins, DevOps engineers, and developers managing multiple databases across VPS environments lack a unified, visible backup solution that supports both full and incremental backups. Existing approaches fall short:

- **Custom shell scripts** — no visibility, no UI, hard to manage at scale
- **Existing tools** (e.g., Databaseus) — lack incremental backup support
- **Enterprise solutions** — overkill for individual developers and small teams

### Solution
**Backupeer** — an open-source, self-hosted database backup manager with:
- Web UI dashboard for managing connections, backups, schedules, and restores
- Full + incremental backup support using battle-tested underlying tools
- S3-compatible object storage (S3, Cloudflare R2, MinIO, Backblaze B2)
- Single Docker Compose deployment

### Target Audience
- Individual developers with personal projects
- Sysadmins managing 1–10 servers
- DevOps engineers needing centralized backup management
- Small teams with multiple databases

### Key Differentiator
**Incremental backup support out of the box** — most open-source backup UIs only offer full backups. Backupeer wraps pgBackRest (PG), Percona XtraBackup (MySQL), and Mariabackup (MariaDB) to provide efficient incremental backups with minimal storage overhead.

---

## 2. Goals & Non-Goals

### Goals
- Provide a **unified Web UI** to manage backups across PostgreSQL, MySQL, and MariaDB
- Support **full + incremental** backup modes
- Store backups in **S3-compatible object storage**
- Allow **scheduled** (cron) and **manual** backups
- Provide **one-click restore** from any backup point
- Deploy via **Docker Compose** — single command to start
- Track backup history with status, size, duration, and logs
- Provide clear visibility: what's backed up, when, and storage usage

### Non-Goals (v1)
- No multi-user/team support (single admin user)
- No backup encryption at rest (relies on storage provider encryption)
- No database clustering or replication management
- No monitoring/alerting integration (email, Slack, etc.) — MVP ships with in-app notifications only
- No HA or multi-region deployment
- No Windows support (Docker on Linux/macOS)

---

## 3. Supported Databases (v1)

| Database | Full Backup | Incremental | Underlying Tool |
|---|---|---|---|
| **PostgreSQL** | ✅ | ✅ (WAL-based PITR) | pgBackRest |
| **MySQL 8+** | ✅ | ✅ (page tracking) | Percona XtraBackup |
| **MariaDB 10.5+** | ✅ | ✅ | Mariabackup |

### Future Candidates
- MongoDB (mongodump + oplog)
- SQLite (simple dump)
- Redis (RDB/AOF)

---

## 4. Features

### P0 — Must Have (MVP)

| ID | Feature | Description |
|---|---|---|
| F1 | **DB Connections** | Add, edit, test, and delete database connections (host, port, user, password, database name) |
| F2 | **Full Backup** | On-demand full backup of any connected database |
| F3 | **Incremental Backup** | On-demand incremental backup (based on underlying tool's incremental mechanism) |
| F4 | **Scheduled Backups** | Cron-based schedule with configurable retention policy |
| F5 | **S3-Compatible Storage** | Store backups in S3, Cloudflare R2, MinIO, or Backblaze B2 |
| F6 | **Backup History** | List all backups with status (success/failed/running), size, duration, timestamp |
| F7 | **Restore** | One-click restore from any completed backup (full or incremental chain) |
| F8 | **Web UI Dashboard** | Overview of connections, recent backups, storage usage, schedule status |
| F9 | **Auth** | Basic authentication (single admin user) |
| F10 | **Dark/Light Mode** | Theme toggle supporting both modes |

### P1 — Important (v1.1)

| ID | Feature | Description |
|---|---|---|
| F11 | **Backup Verification** | Verify backup integrity after completion |
| F12 | **Retention Policy** | Auto-delete old backups based on count or age rules |
| F13 | **Download Backup** | Download backup files directly from UI |
| F14 | **Backup Logs** | Detailed per-backup logs with streaming during execution |
| F15 | **Storage Stats** | Storage usage breakdown by database, backup type |

### P2 — Nice to Have (v2+)

| ID | Feature | Description |
|---|---|---|
| F16 | **Notification Integrations** | Email, Telegram, Slack webhook on backup status |
| F17 | **Schedule Templates** | Pre-set schedule options (daily, weekly, custom cron) |
| F18 | **Multi-Restore** | Restore to a different database or server |
| F19 | **Compression Settings** | Configurable compression level per backup policy |
| F20 | **Export/Import Config** | Export/import connection and schedule config as JSON |

---

## 5. User Flows

### Flow 1: Add Database Connection
```
Dashboard → Add Connection → Select DB Type (PG/MySQL/MariaDB)
  → Fill connection details (host, port, user, pass, database)
  → Test Connection ✅
  → Save → Connection appears in list
```

### Flow 2: Run Backup
```
Connections → Select DB → "Backup Now"
  → Choose Type: Full / Incremental
  → Choose Storage: S3/R2/MinIO/...
  → Start Backup
  → Real-time progress in modal → Status updates
  → On complete → shown in Backup History with green badge
```

### Flow 3: Schedule Backup
```
Schedules → Create Schedule
  → Select DB Connection
  → Backup Type: Full / Incremental
  → Cron Expression (or preset picker)
  → Retention: Keep last N full + incremental
  → Save → Schedule active with status indicator
```

### Flow 4: Restore
```
Backup History → Select backup → "Restore"
  → Confirm: Target DB (same or different)
  → Confirm: This will overwrite data
  → Start Restore
  → Real-time progress
  → On complete → success/failure notification
```

---

## 6. Technical Architecture

### Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend** | Go 1.22+ | Static binary, embedded UI, excellent S3 SDK |
| **Config DB** | SQLite (embedded) | Zero external dependencies, single file |
| **Web UI** | Vanilla JS SPA | Familiar pattern (like Arus console), no build step |
| **Scheduler** | robfig/cron | Mature Go cron library |
| **Object Storage** | aws-sdk-go-v2 | S3-compatible (R2, MinIO, Backblaze) |
| **Container** | Docker / Docker Compose | Single `docker compose up` to deploy |
| **Icons** | Lucide | MIT, feather-style SVG icons |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Container                       │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Go Backend  │  │   SQLite DB  │  │  Static Files  │  │
│  │  (REST API)  │──│ (config,     │  │  (embedded     │  │
│  │  + Scheduler │  │  history,    │  │   Web UI)      │  │
│  │              │  │  schedules)  │  │                │  │
│  └──────┬───────┘  └──────────────┘  └────────────────┘  │
│         │                                                  │
│  ┌──────▼────────────────────────────────────────┐        │
│  │              Backup Engine                      │        │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────────┐  │        │
│  │  │pgBackRest│ │XtraBackup │ │ Mariabackup   │  │        │
│  │  │  (PG)    │ │ (MySQL)   │ │ (MariaDB)     │  │        │
│  │  └──────────┘ └───────────┘ └──────────────┘  │        │
│  └──────────────────┬────────────────────────────┘        │
│                     │                                      │
│                     ▼                                      │
│              S3/R2/MinIO/Backblaze                         │
└─────────────────────────────────────────────────────────┘
```

### Data Model (SQLite)

```sql
-- Database connections
CREATE TABLE connections (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    db_type     TEXT NOT NULL CHECK(db_type IN ('postgresql', 'mysql', 'mariadb')),
    host        TEXT NOT NULL,
    port        INTEGER NOT NULL,
    username    TEXT NOT NULL,
    password    TEXT NOT NULL,  -- encrypted at rest
    database    TEXT NOT NULL,
    ssl_mode    TEXT DEFAULT 'prefer',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup schedules
CREATE TABLE schedules (
    id              TEXT PRIMARY KEY,
    connection_id   TEXT NOT NULL REFERENCES connections(id),
    backup_type     TEXT NOT NULL CHECK(backup_type IN ('full', 'incremental')),
    cron_expr       TEXT NOT NULL,
    storage_config  TEXT NOT NULL,  -- JSON: endpoint, bucket, region, access_key, secret_key
    retention_full  INTEGER DEFAULT 7,
    retention_incr  INTEGER DEFAULT 30,
    enabled         INTEGER DEFAULT 1,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup history
CREATE TABLE backups (
    id              TEXT PRIMARY KEY,
    connection_id   TEXT NOT NULL REFERENCES connections(id),
    schedule_id     TEXT REFERENCES schedules(id),
    backup_type     TEXT NOT NULL CHECK(backup_type IN ('full', 'incremental')),
    status          TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed')),
    storage_path    TEXT NOT NULL,
    size_bytes      INTEGER,
    duration_ms     INTEGER,
    checksum        TEXT,
    log_output      TEXT,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restore history
CREATE TABLE restores (
    id              TEXT PRIMARY KEY,
    backup_id       TEXT NOT NULL REFERENCES backups(id),
    target_connection TEXT REFERENCES connections(id),
    status          TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed')),
    duration_ms     INTEGER,
    log_output      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App settings
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## 7. API Endpoints (v1)

```
GET    /api/health                  — Health check
POST   /api/auth/login              — Login

GET    /api/connections             — List connections
POST   /api/connections             — Add connection
GET    /api/connections/:id         — Get connection
PUT    /api/connections/:id         — Update connection
DELETE /api/connections/:id         — Delete connection
POST   /api/connections/:id/test   — Test connection

GET    /api/backups                 — List backups (paginated, filterable)
POST   /api/backups                 — Start backup (full/incremental)
GET    /api/backups/:id             — Backup detail
GET    /api/backups/:id/logs        — Backup logs (streaming)
DELETE /api/backups/:id             — Delete backup (remote + local record)
POST   /api/backups/:id/restore     — Restore from backup

GET    /api/schedules               — List schedules
POST   /api/schedules               — Create schedule
PUT    /api/schedules/:id           — Update schedule
DELETE /api/schedules/:id           — Delete schedule
POST   /api/schedules/:id/run       — Run schedule immediately

GET    /api/restores                — List restores
GET    /api/storage/stats           — Storage usage stats
GET    /api/settings                — Get settings
PUT    /api/settings                — Update settings
```

---

## 8. Non-Functional Requirements

### Performance
- Backup start latency: < 2s (schedule dispatch to process start)
- Dashboard page load: < 1s (first 50 backups)
- Concurrent backups: support at least 3 simultaneous backup jobs
- Log streaming: real-time via SSE or polling (500ms interval)

### Security
- Passwords stored encrypted at rest (AES-256-GCM)
- Auth: session-based with secure HTTP-only cookies
- CORS: restrict to same-origin
- Backup credentials (S3 keys) stored encrypted
- No plaintext secrets in logs

### Reliability
- Backup jobs survive server restart (state persisted in SQLite)
- Retry on transient failures (up to 3 attempts for incremental)
- Graceful degradation: if storage is unreachable, fail with clear message
- Logs capture full stdout/stderr from underlying tools

### Deployment
- Single `docker compose up` to start
- Docker image published to GitHub Container Registry (`ghcr.io/edsuwarna/backupeer`)
- Configuration via environment variables + Web UI
- Data persistence: SQLite + backup cache mounted as volumes

### Scalability
- Not designed for horizontal scaling (SQLite single-instance)
- Suitable for: 1–50 database connections, 1000+ backup history entries
- Storage is bound by S3 bucket capacity (effectively unlimited)

---

## 9. Design System

See `DESIGN.md` in the project root for the complete design token reference.

| Aspect | Value |
|---|---|
| **Accent Color** | Teal (`#0d9488`) with bright variant (`#06b6d4`) |
| **Theme** | Dark mode (default) + Light mode toggle |
| **Typography** | Inter (UI), JetBrains Mono (code) |
| **Icons** | Lucide (MIT, feather-style SVG) |
| **Rounded** | 4–8px corners — precise, not playful |
| **Surface Separation** | Hairlines (dark mode), subtle shadows (light mode) |

---

## 10. Delivery Roadmap

### Phase 1: Foundation (v0.1)
- [ ] Project scaffolding (Go module, directory structure)
- [ ] SQLite schema + migrations
- [ ] Auth (login/session)
- [ ] Connections CRUD + test
- [ ] Initial Dockerfile + docker-compose.yml
- [ ] Static file serving (embedded Web UI)

### Phase 2: Backup Engine (v0.2)
- [ ] pgBackRest integration (full + incremental)
- [ ] XtraBackup integration (full + incremental)
- [ ] Mariabackup integration (full + incremental)
- [ ] S3-compatible storage client
- [ ] Backup execution (manual trigger)
- [ ] Real-time log streaming

### Phase 3: Scheduling & Restore (v0.3)
- [ ] Cron scheduler (robfig/cron)
- [ ] Schedule CRUD
- [ ] Restore flow (full + incremental chain)
- [ ] Backup history with status/size/duration
- [ ] Retention policy enforcement

### Phase 4: UI MVP (v0.4)
- [ ] Dashboard page
- [ ] Connections page
- [ ] Backups history page
- [ ] Schedule management page
- [ ] Dark/Light mode toggle
- [ ] Responsive layout

### Phase 5: Polish (v1.0)
- [ ] Error handling & edge cases
- [ ] Empty states, loading states, error states
- [ ] Docker image optimization (multi-stage)
- [ ] CI/CD (GitHub Actions)
- [ ] README + docs
- [ ] DESIGN.md validation pass

---

## 11. Open Questions

- **Database passwords:** encrypt with a master key from env var or use OS keyring?
- **Default export path for Docker:** volume at `/var/lib/backupeer/data`?
- **pgBackRest stanza config:** auto-manage or require manual stanza creation?
- **Health check endpoint:** basic or include DB ping + storage check?
- **API docs:** Swagger/OpenAPI or markdown in repo?

---

## 12. Glossary

| Term | Definition |
|---|---|
| **Full Backup** | Complete copy of all database data |
| **Incremental Backup** | Backup of changes since the last full or incremental backup |
| **WAL** | Write-Ahead Log (PostgreSQL's transaction log) |
| **PITR** | Point-In-Time Recovery — restore to any moment |
| **S3-Compatible** | Object storage API compatible with Amazon S3 |
| **Stanza** | pgBackRest configuration for a single database cluster |
| **Retention** | How many backup sets to keep before auto-deletion |
