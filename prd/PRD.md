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
|---|---|---|---|
| F1 | **DB Connections** | Add, edit, test, and delete database connections at **server level** (host, port, user, password). Backend auto-discovers databases within the server. |
| F2 | **Full Backup** | On-demand full backup of any connected database |
| F3 | **Incremental Backup** | On-demand incremental backup (based on underlying tool's incremental mechanism) |
| F4 | **Scheduled Backups** | Cron-based schedule with configurable retention policy |
| F5 | **S3-Compatible Storage** | Store backups in S3, Cloudflare R2, MinIO, or Backblaze B2 |
| F6 | **Backup History** | List all backups with status (success/failed/running), size, duration, timestamp |
| F7 | **Restore** | One-click restore from any completed backup (full or incremental chain) |
| F8 | **Web UI Dashboard** | Overview of connections, recent backups, storage usage, schedule status |
| F9 | **Encryption at Rest** | **Client-side AES-256-GCM encryption** before upload — provider can't read data |
| F10 | **Backup Verification** | Verify backup integrity via checksum + optional periodic restore-to-temp validation |
| F11 | **Auth** | Basic authentication (single admin user) |
| F12 | **Dark/Light Mode** | Theme toggle supporting both modes |

### P1 — Important (v1.1)

| ID | Feature | Description |
|---|---|---|---|
| F13 | **Retention Policy** | Auto-delete old backups based on count or age rules |
| F14 | **Download Backup** | Download backup files directly from UI |
| F15 | **Backup Logs** | Detailed per-backup logs with streaming during execution |
| F16 | **Storage Stats** | Storage usage breakdown by database, backup type |

### P2 — Nice to Have (v2+)

| ID | Feature | Description |
|---|---|---|---|
| F17 | **Notification Integrations** | Email, Telegram, Slack webhook on backup status |
| F18 | **Schedule Templates** | Pre-set schedule options (daily, weekly, custom cron) |
| F19 | **Multi-Restore** | Restore to a different database or server |
| F20 | **Compression Settings** | Configurable compression level per backup policy |
| F21 | **Export/Import Config** | Export/import connection and schedule config as JSON |

---

## 5. User Flows

### Flow 1: Add Database Connection
```
Dashboard → Add Connection → Select DB Type (PG/MySQL/MariaDB)
  → Fill connection details (host, port, user, pass)
  → Test Connection ✅
  → Save → Backend auto-discovers databases on server
  → Select databases to include for backup (checkboxes)
  → Connection appears in list with DB count badge
```

### Flow 2: Run Backup
```
Connections → Select DB Connection
  → Select Database (from discovered list)
  → "Backup Now"
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
  → Select Database (from discovered list)
  → Backup Type: Full / Incremental
  → Cron Expression (or preset picker)
  → Retention: Keep last N full + incremental
  → Save → Schedule active with status indicator
```

### Flow 4: Restore
```
Backup History → Select backup → "Restore"
  → Confirm: Target Connection + Database (same or different)
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
    ssl_mode    TEXT DEFAULT 'prefer',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discovered databases per connection (server-level)
CREATE TABLE connection_databases (
    id              TEXT PRIMARY KEY,
    connection_id   TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    db_name         TEXT NOT NULL,       -- actual database name on server
    is_selected     INTEGER DEFAULT 1,  -- user opted in for backup?
    size_bytes      INTEGER,            -- cached DB size from discovery
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id, db_name)
);

-- Backup schedules
CREATE TABLE schedules (
    id              TEXT PRIMARY KEY,
    connection_id   TEXT NOT NULL REFERENCES connections(id),
    database_id     TEXT NOT NULL REFERENCES connection_databases(id),
    backup_type     TEXT NOT NULL CHECK(backup_type IN ('full', 'incremental')),
    cron_expr       TEXT NOT NULL,
    storage_config  TEXT NOT NULL,  -- JSON: endpoint, bucket, region, access_key, secret_key
    encryption_enabled INTEGER DEFAULT 1,
    encryption_key_id TEXT,
    verify_enabled  INTEGER DEFAULT 0,    -- auto-restore-verify after backup
    retention_full  INTEGER DEFAULT 7,
    retention_incr  INTEGER DEFAULT 30,
    enabled         INTEGER DEFAULT 1,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup history
CREATE TABLE backups (
    id              TEXT PRIMARY KEY,
    connection_id   TEXT NOT NULL REFERENCES connections(id),
    database_id     TEXT NOT NULL REFERENCES connection_databases(id),
    schedule_id     TEXT REFERENCES schedules(id),
    backup_type     TEXT NOT NULL CHECK(backup_type IN ('full', 'incremental')),
    status          TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed', 'verifying')),
    storage_path    TEXT NOT NULL,
    size_bytes      INTEGER,
    encrypted_size_bytes INTEGER,        -- size after encryption (actual S3 usage)
    encryption_algo TEXT DEFAULT 'aes-256-gcm',
    encryption_key_id TEXT,               -- references the key used
    checksum        TEXT,                 -- SHA-256 of raw backup
    encrypted_checksum TEXT,              -- SHA-256 of encrypted blob (verify S3 integrity)
    verified_at     TIMESTAMP,            -- last successful verification
    verify_status   TEXT CHECK(verify_status IN ('pending', 'passed', 'failed')),
    duration_ms     INTEGER,
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

-- Encryption keys
CREATE TABLE encryption_keys (
    id              TEXT PRIMARY KEY,
    alias           TEXT NOT NULL UNIQUE,  -- user-friendly name
    key_derivation  TEXT NOT NULL CHECK(key_derivation IN ('env', 'vault', 'manual')),
    key_salt        TEXT NOT NULL,          -- for key derivation
    key_check       TEXT NOT NULL,          -- encrypted test vector to verify key is correct
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at      TIMESTAMP,
    is_active       INTEGER DEFAULT 1
);
```

### Database Discovery & Management

When a connection is saved, the backend immediately connects to the server and auto-discovers available databases:

| Database | Discovery Query |
|---|---|
| **PostgreSQL** | `SELECT datname FROM pg_database WHERE datistemplate = false` |
| **MySQL** | `SHOW DATABASES` |
| **MariaDB** | `SHOW DATABASES` |

**Discovery Flow:**
```
Connection Saved → Connect to server → Run discovery query
  → List all non-system databases
  → Cache database_name + size_bytes in connection_databases
  → Return to UI → Show checkboxes (all selected by default)
  → User uncheck which DBs to exclude → Save selection
```

**UI Representation:**
```
Connections
├── Production PG (prod.example.com:5432)
│   ├── 🟢 app_production       [selected]   size: 1.2 GB
│   ├── 🟢 app_staging          [selected]   size: 240 MB
│   ├── 🟢 analytics            [selected]   size: 3.1 GB
│   ├── ⚪ logs_archive         [deselected] size: 50 MB
│   └── + 6 more databases
│       [Re-discover] [Select All / None]
```

**Per-Database vs Server-Level Operations:**

| Operation | Full Backup | Incremental Backup |
|---|---|---|
| **Scope** | Per-database (`pg_dump db1`, `pg_dump db2`) | Server-level (pgBackRest/XtraBackup works on PGDATA) |
| **Storage** | One S3 object per database | One S3 object per server (includes all DBs) |
| **Restore** | Can restore a single DB independently | Must restore entire server, or extract single DB |
| **Schedule** | Each database can have its own schedule | One schedule covers all DBs on the server |

**Data Model Impact:**
- `schedules.database_id` — each schedule targets one specific database
- `backups.database_id` — each backup run is for a single database
- To backup all databases on a server, user creates one schedule per database (or a future "batch schedule" for v2)
- Incremental backup ignores `database_id` and works at server level (tracked via `connection_id` only)

### Encryption Flow

```
                    ┌─────────────────────────┐
                    │  Master Key (env/VAULT)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Key Derivation (Argon2) │
                    │  + Per-backup Salt       │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
     ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
     │ Backup Stream │  │   AES-256     │  │  Encrypted    │
     │ (pg_dump/     │→ │   GCM Tag     │→ │  Blob → S3    │
     │  XtraBackup)  │  │   + SHA-256   │  │               │
     └───────────────┘  └───────────────┘  └───────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  encrypted_      │
                     │  checksum stored │
                     │  in DB metadata  │
                     └──────────────────┘
```

### Key Management

- **Default:** Key derived from `BACKUPEER_ENCRYPTION_KEY` environment variable
- **Future:** HashiCorp Vault integration for enterprise deployments
- Keys are **never** stored in the database — only `key_salt` + `key_check` (verification token)
- Rotation support: re-key old backups by decrypting and re-encrypting with new key

---

## 7. Encryption & Verification Strategy

### 7.1 Encryption at Rest

Backupeer uses **client-side AES-256-GCM** encryption — your data is encrypted before it leaves the container:

| Layer | Detail |
|---|---|
| **Algorithm** | AES-256-GCM (authenticated encryption) |
| **Key Derivation** | Argon2id (memory-hard, resists GPU brute-force) |
| **Per-backup Salt** | Unique random salt per backup — same data ≠ same ciphertext |
| **Auth Tag** | GCM provides integrity verification built-in |
| **Nonce** | 96-bit random nonce per encryption |
| **Output Format** | `[salt 16B][nonce 12B][tag 16B][ciphertext...]` |
| **Checksum Chain** | Raw SHA-256 + Encrypted SHA-256 — verify both |

**Per-backup encryption key derivation:**
```
master_key = BACKUPEER_ENCRYPTION_KEY (from env)
per_backup_key = Argon2id(master_key, backup_salt, time=3, mem=64MB)
ciphertext = AES-256-GCM(per_backup_key, nonce, plaintext)
```

### 7.2 Why Client-Side?

| Scenario | SSE (server-side) | Client-side AES-256-GCM |
|---|---|---|
| S3/R2 bucket compromised | ❌ Data readable | ✅ Exposed = ciphertext only |
| Cloud provider employee access | ❌ Can read backups | ✅ Cannot read backups |
| Multi-region compliance | ❌ Depends on provider | ✅ Lo control the key |
| Performance overhead | ✅ None | ⚡ ~50 MB/s per core |
| Key management | ✅ Managed by provider | ⚡ Lo manage the key |

### 7.3 Verification Strategy

Backupeer supports **3 levels** of verification, configurable per schedule:

#### Level 1: Checksum (always on)

```
Backup complete → SHA-256(raw + encrypted) → Store in DB
                                                     ↓
On verify → Re-download → SHA-256(encrypted) → Compare with stored
                                                     ↓
                                          Pass/Fail → alerts in UI
```

- Runs immediately after every backup
- Verifies encrypted blob integrity on S3
- Catches: corrupted upload, storage bit-rot, truncation

#### Level 2: Decrypt + Checksum (if encryption enabled)

- Download encrypted blob
- Decrypt with stored key derivation params
- SHA-256(decrypted) == checksum from backup time
- Catches: key mismatch, corrupted ciphertext

#### Level 3: Restore Test (scheduled, P1)

```
Schedule: "Verify backup every Sunday 03:00"

Download → Decrypt → Restore to temp Docker container
    → Run check queries:
        - Row count matches known baseline
        - Latest timestamp is sane
        - Key constraints intact
    → Report: ✅ Pass / ❌ Fail with query output
    → Tear down temp container
```

- Resource-intensive, so **opt-in per schedule**
- Runs in isolated Docker container (auto-removed after)
- Configurable: which tables/rows to verify
- Ideal for: production databases where data integrity is critical

### 7.4 Encryption toggles in UI

Per backup policy (schedule):

```
┌───────────────────────────────────────┐
│  🔒 Encryption                        │
│  [✓] Encrypt backups (AES-256-GCM)    │
│  [ ] Auto-verify after backup         │
│  [ ] Periodic restore test            │
│      Schedule: ┌──────────────┐       │
│      │ 0 3 * * 0 │ (weekly)   │       │
│      └──────────────┘               │
│  Key: default (env)                  │
└───────────────────────────────────────┘
```

### 7.5 Verification dashboard

Backup history shows verification status per row:

| Backup | Size | Status | Verify | Last Verified |
|---|---|---|---|---|
| production-pg | 1.2 GB | ✅ Completed | ✅ Passed | 2 min ago |
| staging-mysql | 240 MB | ✅ Completed | ⏳ Pending | — |
| analytics-mariadb | — | ⚠️ Retrying | ❌ Failed | 1h ago |

---

## 8. API Endpoints (v1)

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

## 9. Non-Functional Requirements

### Performance
- Backup start latency: < 2s (schedule dispatch to process start)
- Dashboard page load: < 1s (first 50 backups)
- Concurrent backups: support at least 3 simultaneous backup jobs
- Log streaming: real-time via SSE or polling (500ms interval)

### Security
- Passwords stored encrypted at rest (AES-256-GCM)
- Backup data encrypted with client-side AES-256-GCM before upload
- Encryption key never stored in DB — only derived salt + verification token
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

## 10. Design System

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

## 11. Delivery Roadmap

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
- [ ] **Client-side AES-256-GCM encryption pipeline**
- [ ] **SHA-256 checksum generation (raw + encrypted)**
- [ ] **Encryption key management (env-based)**

### Phase 3: Scheduling & Restore (v0.3)
- [ ] Cron scheduler (robfig/cron)
- [ ] Schedule CRUD
- [ ] Restore flow (full + incremental chain)
- [ ] Backup history with status/size/duration
- [ ] Retention policy enforcement
- [ ] **Checksum verification on restore (Level 1)**
- [ ] **Encryption toggles per schedule (UI)**

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

## 12. Open Questions

- **Database passwords:** encrypt with a master key from env var or use OS keyring?
- **Encryption key source:** env var only, or support Vault/external KMS from v1?
- **Key rotation:** provide UI for re-keying existing backups, or just new backups?
- **Restore test isolation:** spin up temp container per verify, or use shared container pool?
- **Default export path for Docker:** volume at `/var/lib/backupeer/data`?
- **pgBackRest stanza config:** auto-manage or require manual stanza creation?
- **Health check endpoint:** basic or include DB ping + storage check?
- **API docs:** Swagger/OpenAPI or markdown in repo?

---

## 13. Glossary

| Term | Definition |
|---|---|---|
| **Full Backup** | Complete copy of all database data |
| **Incremental Backup** | Backup of changes since the last full or incremental backup |
| **WAL** | Write-Ahead Log (PostgreSQL's transaction log) |
| **PITR** | Point-In-Time Recovery — restore to any moment |
| **AES-256-GCM** | Authenticated encryption: confidentiality + integrity in one algorithm |
| **Argon2id** | Memory-hard key derivation function — resists GPU/ASIC brute-force |
| **Salt** | Unique random value per backup — ensures same plaintext ≠ same ciphertext |
| **Client-Side Encryption** | Data encrypted before leaving source — storage provider never sees plaintext |
| **Checksum Verification** | SHA-256 hash comparison to detect corruption in transit or at rest |
| **Restore Test** | Full verification: download → decrypt → restore to temp → run integrity queries |
| **S3-Compatible** | Object storage API compatible with Amazon S3 |
| **Stanza** | pgBackRest configuration for a single database cluster |
| **Retention** | How many backup sets to keep before auto-deletion |
