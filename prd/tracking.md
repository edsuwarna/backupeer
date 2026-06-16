# Backupeer — Delivery Tracking

> Track feature delivery and project milestones.

## Milestones

| Milestone | Target | Status |
|---|---|---|
| M1: DESIGN.md | 2026-06-16 | ✅ Done |
| M2: PRD v1 | 2026-06-16 | ✅ Done |
| M3: Phase 1 — Foundation | TBD | ⏳ Not Started |
| M4: Phase 2 — Backup Engine | TBD | ⏳ Not Started |
| M5: Phase 3 — Scheduling & Restore | TBD | ⏳ Not Started |
| M6: Phase 4 — UI MVP | TBD | ⏳ Not Started |
| M7: Phase 5 — Polish & v1.0 | TBD | ⏳ Not Started |

---

## Phase 1: Foundation (v0.1)

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | Go project scaffolding | ⏳ | |
| 1.2 | SQLite schema + migrations | ⏳ | |
| 1.3 | Auth (login / sessions) | ⏳ | |
| 1.4 | Connections CRUD + test endpoint | ⏳ | |
| 1.5 | Dockerfile + docker-compose.yml | ⏳ | |
| 1.6 | Embedded static file serving | ⏳ | |
| 1.7 | Health check endpoint | ⏳ | |
| 1.8 | CI: GitHub Actions — lint | ⏳ | |

## Phase 2: Backup Engine (v0.2)

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | pgBackRest integration (full) | ⏳ | |
| 2.2 | pgBackRest integration (incremental) | ⏳ | |
| 2.3 | XtraBackup integration (full) | ⏳ | |
| 2.4 | XtraBackup integration (incremental) | ⏳ | |
| 2.5 | Mariabackup integration (full + incr) | ⏳ | |
| 2.6 | S3-compatible storage client | ⏳ | |
| 2.7 | Backup execution engine | ⏳ | |
| 2.8 | Real-time log streaming (SSE) | ⏳ | |
| 2.9 | Backup history persistence | ⏳ | |

## Phase 3: Scheduling & Restore (v0.3)

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Cron scheduler (robfig/cron) | ⏳ | |
| 3.2 | Schedule CRUD API | ⏳ | |
| 3.3 | Restore flow — full backup | ⏳ | |
| 3.4 | Restore flow — incremental chain | ⏳ | |
| 3.5 | Retention policy enforcement | ⏳ | |
| 3.6 | Manual trigger: "Run Now" | ⏳ | |

## Phase 4: UI MVP (v0.4)

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Dashboard page | ⏳ | |
| 4.2 | Connections page (list + form) | ⏳ | |
| 4.3 | Backups history page | ⏳ | |
| 4.4 | Schedule management page | ⏳ | |
| 4.5 | Dark / Light mode toggle | ⏳ | |
| 4.6 | Backup detail + live logs | ⏳ | |
| 4.7 | Restore confirmation flow | ⏳ | |
| 4.8 | Responsive layout | ⏳ | |

## Phase 5: Polish & v1.0 (v1.0)

| # | Task | Status | Notes |
|---|---|---|---|
| 5.1 | Error handling — all states | ⏳ | |
| 5.2 | Empty / loading / error UI states | ⏳ | |
| 5.3 | Multi-stage Docker build | ⏳ | |
| 5.4 | GitHub Actions — build + push image | ⏳ | |
| 5.5 | README.md — quick start + usage | ⏳ | |
| 5.6 | DESIGN.md validation | ⏳ | |
| 5.7 | License file (Apache 2.0) | ⏳ | |

---

## Legend

| Icon | Status |
|---|---|
| ✅ | Done |
| ⏳ | Not Started |
| 🔄 | In Progress |
| ❌ | Blocked |
| 🎯 | In Review |
