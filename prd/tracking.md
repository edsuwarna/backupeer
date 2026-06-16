# Backupeer — Delivery Tracking

> Track feature delivery and project milestones.

## Milestones

| Milestone | Target | Status |
|---|---|---|
| M1: DESIGN.md | 2026-06-16 | ✅ Done |
| M2: PRD v1 | 2026-06-16 | ✅ Done |
| M3: Phase 1 — Foundation | 2026-06-16 | ✅ Done |
| M4: Phase 2 — Backup Engine | 2026-06-16 | ✅ Done |
| M5: Phase 3 — Scheduling & Restore | 2026-06-16 | ✅ Done |
| M6: Phase 4 — UI MVP | 2026-06-16 | ✅ Done |
| M7: Phase 5 — Polish & v1.0 | 2026-06-16 | ✅ Done |

---

## Phase 1: Foundation (v0.1)

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | Go project scaffolding | ✅ Done | |
| 1.2 | SQLite schema + migrations | ✅ Done | 7 tables + indexes |
| 1.3 | Auth (login / sessions) | ✅ Done | SHA-256 sessions |
| 1.4 | Connections CRUD + test endpoint | ✅ Done | |
| 1.5 | Dockerfile + docker-compose.yml | ✅ Done | Alpine multi-stage |
| 1.6 | Embedded static file serving | ✅ Done | |
| 1.7 | Health check endpoint | ✅ Done | |
| 1.8 | CI: GitHub Actions — lint | ⏳ | |

## Phase 2: Backup Engine (v0.2)

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | pg_dump full backup | ✅ Done | pg_dump -Fc custom format |
| 2.2 | pg_dump incremental support | 🟡 Partial | backup_type param stored, uses same pg_dump (not WAL-based) |
| 2.3 | mysqldump full backup | ✅ Done | mysqldump --single-transaction |
| 2.4 | MySQL incremental support | 🟡 Partial | backup_type param stored, no Percona XtraBackup yet |
| 2.5 | MariaDB full + incr backup | 🟡 Partial | Auto-detects mariadb-dump, incr param stored |
| 2.6 | S3-compatible storage client | ✅ Done | MinIO SDK (AWS, R2, MinIO, B2) |
| 2.7 | Backup execution engine | ✅ Done | Async goroutine pipeline |
| 2.8 | Real-time log streaming (SSE) | ⏳ | MVP uses log polling |
| 2.9 | Backup history persistence | ✅ Done | |
| 2.10 | **Backup verification runner** (F10) | ✅ Done | POST /api/backups/{id}/verify — download + checksum verify |
| 2.11 | **Download backup** (F14) | ✅ Done | GET /api/backups/{id}/download — streams from S3 |

## Phase 3: Scheduling & Restore (v0.3)

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Cron scheduler (robfig/cron) | ✅ Done | Auto-loads on startup |
| 3.2 | Schedule CRUD API | ✅ Done | |
| 3.3 | Restore flow — full backup | ✅ Done | pg_restore / mysql CLI |
| 3.4 | Restore flow — incremental chain | ⏳ | Full restore works, chain not yet |
| 3.5 | **Retention policy enforcement** (F13) | ✅ Done | Auto-deletes old backups per schedule retention settings |
| 3.6 | Manual trigger: "Run Now" | ✅ Done | |
| 3.7 | Retention — auto-call after scheduled backup | ✅ Done | Scheduler calls EnforceRetention post-backup |

## Phase 4: UI MVP (v0.4)

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Dashboard page | ✅ Done | Stats + recent backups |
| 4.2 | Connections page (list + form) | ✅ Done | Modal forms |
| 4.3 | Backups history page | ✅ Done | With restore, download, verify, log viewer |
| 4.4 | Schedule management page | ✅ Done | Run/toggle/delete |
| 4.5 | Dark / Light mode toggle | ✅ Done | |
| 4.6 | Backup detail + live logs | ✅ Done | Modal log viewer |
| 4.7 | Restore confirmation flow | ✅ Done | Modal with target selector |
| 4.8 | Responsive layout | ✅ Done | Mobile-friendly |
| 4.9 | **Download button in backup table** | ✅ Done | Streams from S3 |
| 4.10 | **Verify button in backup table** | ✅ Done | Triggers async integrity check |

## Phase 5: Polish & v1.0 (v1.0)

| # | Task | Status | Notes |
|---|---|---|---|
| 5.1 | Error handling — all states | 🟡 Partial | Most endpoints have proper errors, some raw 500 remain |
| 5.2 | Empty / loading / error UI states | ✅ Done | |
| 5.3 | Multi-stage Docker build | ✅ Done | |
| 5.4 | GitHub Actions — build + push image | ⏳ | |
| 5.5 | README.md — quick start + usage | ⏳ | |
| 5.6 | DESIGN.md validation | ⏳ | |
| 5.7 | License file (Apache 2.0) | ⏳ | |

## PRD Feature Status

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F1 | DB Connections | P0 | ✅ Done | |
| F2 | Full Backup | P0 | ✅ Done | |
| F3 | Incremental Backup | P0 | 🟡 Partial | API + model support, no WAL/XtraBackup engine |
| F4 | Scheduled Backups | P0 | ✅ Done | With retention |
| F5 | S3-Compatible Storage | P0 | ✅ Done | |
| F6 | Backup History | P0 | ✅ Done | |
| F7 | Restore | P0 | ✅ Done | Full restore only |
| F8 | Web UI Dashboard | P0 | ✅ Done | |
| F9 | Encryption at Rest | P0 | ✅ Done | AES-256-GCM |
| F10 | Backup Verification | P0 | ✅ Done | POST /api/backups/{id}/verify |
| F11 | Auth | P0 | ✅ Done | |
| F12 | Dark/Light Mode | P0 | ✅ Done | |
| F13 | Retention Policy | P1 | ✅ Done | Per-schedule, auto-enforced |
| F14 | Download Backup | P1 | ✅ Done | Stream from S3 |
| F15 | Backup Logs | P1 | ✅ Done | |
| F16 | Storage Stats | P1 | ✅ Done | GET /api/backups/stats |
