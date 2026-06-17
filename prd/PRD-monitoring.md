# Backupeer — Database Monitoring & TimescaleDB Migration

> **Version:** 1.1
> **Status:** Draft
> **Author:** Endang Suwarna
> **Date:** 2026-06-17

---

## 1. Executive Summary

### Problem Statement

Backupeer saat ini menggunakan **SQLite** sebagai database internal untuk menyimpan konfigurasi (connections, schedules, storage providers) dan riwayat backup. SQLite cukup untuk use case tersebut — tapi ketika kita ingin menambahkan **database monitoring**, ada beberapa keterbatasan:

| Masalah | Detail |
|---------|--------|
| **Write contention** | Monitoring data ditulis tiap 5 menit, backup status juga nulis — bisa antri di SQLite single-writer |
| **Time-series scalability** | SQLite gak punya optimasi untuk time-series queries (partitioning, downsampling, compression) |
| **Retention management** | Harus manual `DELETE` + `VACUUM` — berpotensi bloat dan fragmentation |
| **No JOIN capability** | Monitoring data (TimescaleDB) dan config data (SQLite) gabisa di-join — analisis terbatas |
| **Dual-system maintenance** | 2 DB = 2 backup strategy, 2 migration system, 2 connection |

### Proposed Solution

1. **Migrasi SQLite → TimescaleDB** (unified database) — semua data config + monitoring dalam 1 DB
2. **Tambahkan Database Monitoring Engine** — health check, size tracking, metrics collection, alerting

### Target Audience

Sama dengan Backupeer: DevOps engineers, sysadmins, dan developers yang manage 1-50+ database server.

### Key Differentiator

**Backupeer bukan cuma backup tool — jadi unified database observability platform.** Backup + Monitoring dalam 1 dashboard, 1 deployment.

---

## 2. Goals & Non-Goals

### Goals
- ✅ **Unified database**: Config + backup history + monitoring dalam 1 TimescaleDB instance
- ✅ **TimescaleDB-native time-series**: Auto-partition (hypertable), compression, retention policy
- ✅ **JOIN antara config dan monitoring**: Contoh: `SELECT * FROM backups JOIN health_checks WHERE latency > 100ms`
- ✅ **Connection health monitoring**: Ping tiap 5 menit, track latency & error rate
- ✅ **Database size tracking**: Pantau growth per database dari waktu ke waktu
- ✅ **Active connections monitoring**: Deteksi connection spikes
- ✅ **Performance profiling**: Slow queries, cache hit ratio, connection usage %
- ✅ **Retention otomatis**: Auto-hapus data monitoring > 90 hari via TimescaleDB policy
- ✅ **Backup analytics**: Duration trend, size trend, success rate dashboard
- ✅ **No performance impact**: Pipeline backup streaming tetap ~64KB memory — gak nyentuh DB
- ✅ **Multi-DB coverage**: Query performance views langsung — PostgreSQL (`pg_stat_*`), MySQL/MariaDB (`performance_schema`)
- ✅ **pgbadger-inspired metrics**: Ambil validated metric set dari pgbadger (13 tahun production use), tanpa perlu baca log

### Non-Goals (v1)
- ❌ Replication monitoring (slave lag, WAL stats)
- ❌ Table-level bloat analysis
- ❌ Anomaly detection AI/ML-based
- ❌ Multi-user/team monitoring dashboard
- ❌ Custom alert thresholds per metric
- ❌ Log-based analysis (pgbadger-style post-mortem from PostgreSQL logs)

---

## 3. Tech Stack Decision — Why TimescaleDB?

### Option Comparison

| Aspek | SQLite (current) | PostgreSQL | TimescaleDB ✅ |
|-------|-----------------|-----------|----------------|
| **Time-series optimization** | ❌ None | ❌ Manual partition | ✅ Hypertable auto-partition |
| **Compression** | ❌ None | ❌ None (TOAST only) | ✅ ~90-94% ratio |
| **Auto-retention** | ❌ Manual query | ❌ Manual cron | ✅ `add_retention_policy()` |
| **Continuous aggregates** | ❌ None | ❌ Materialized view manual | ✅ Auto-downsample 5m → 1h → 1d |
| **Concurrent writes** | ❌ Single writer | ✅ Multi-writer | ✅ Multi-writer |
| **Gratis & open source** | ✅ MIT | ✅ PostgreSQL license | ✅ Timescale License (Apache 2.0 core) |
| **SQL compatibility** | ✅ Limited | ✅ Full | ✅ Full (PostgreSQL extension) |
| **Maintenance** | ⭐ Simpel | ⭐⭐ Medium | ⭐⭐ Medium (+1 extension) |

### Kenapa Bukan Database Terpisah (SQLite + TimescaleDB)?

| Pertimbangan | 2 DB | 1 DB (TimescaleDB) |
|-------------|------|-------------------|
| **Koneksi** | 2 driver (`go-sqlite3` + `lib/pq`) | 1 driver (`lib/pq`) |
| **JOIN monitoring × config** | ❌ Gak bisa | ✅ Bisa |
| **Backup strategy** | 2 sistem | ✅ 1 `pg_dump` |
| **Migration** | 2 sistem | ✅ 1 migration |
| **Deployment** | 2 container DB? | ✅ 1 container |
| **Maintenance overhead** | 2x lipat | ✅ 1x |

### Kenapa TimescaleDB Bisa Jadi "PostgreSQL Biasa" untuk Config Data

TimescaleDB adalah **PostgreSQL extension** — bukan fork. Semua tabel biasa tetap jalan sebagai tabel PostgreSQL standar:

```sql
-- Tabel biasa (config) — PostgreSQL relational table
CREATE TABLE connections (id TEXT PRIMARY KEY, ...);

-- Tabel time-series — TimescaleDB hypertable
CREATE TABLE health_checks (time TIMESTAMPTZ NOT NULL, ...);
SELECT create_hypertable('health_checks', 'time');
```

**Keduanya bisa di-JOIN** tanpa masalah. Config data gak kena hypertable rules.

### Migration Path

```
SQLite ──▶ pgloader ──▶ TimescaleDB
   │                        │
   └── export dump ─────────┘ (alternative)
```

Approach: **Rewrite repository layer dari SQLite ke lib/pq (PostgreSQL driver)**. Karena Backupeer pake **clean interface pattern** (`Repository interface`), implementasi tinggal diganti — interface-nya tetap.

---

## 4. Feature Requirements — Database Monitoring

### P0 — Must Have (MVP)

| ID | Feature | Description | Collection Interval |
|----|---------|-------------|-------------------|
| M1 | **Connection Health Check** | Ping database (SELECT 1), record up/down + response time (ms) | 5 menit |
| M2 | **Database Size Tracking** | Query ukuran setiap database (`pg_database_size` / `information_schema.tables`) | 1 jam |
| M3 | **Active Connections** | Hitung koneksi aktif per database server | 5 menit |
| M4 | **Monitoring Dashboard Page** | Halaman Web UI baru: health status, size trend charts, connection history | — |
| M5 | **Connection Status Badge** | Widget di halaman Connections: 🟢 up / 🔴 down / ⚠️ degraded | Real-time |
| M6 | **Auto-Retention** | Hapus otomatis data monitoring > 90 hari pake TimescaleDB retention policy | Otomatis |

### P1 — Important (v1.1) — Performance Profiling Layer

Inspired by [pgbadger](https://github.com/darold/pgbadger) — PostgreSQL log analyzer yang udah 13 tahun validated metrics — kita query langsung ke system views tanpa perlu baca log. Support PostgreSQL via `pg_stat_*`, MySQL/MariaDB via `performance_schema`.

| ID | Feature | Description | DB Support |
|----|---------|-------------|------------|
| M7 | **Backup Analytics** | Dashboard: success rate trend, duration trend, size trend per database / per connection | ✅ All |
| M8 | **Slow Queries Detection** | Top N queries by total time / avg time / calls. PG: `pg_stat_statements`, MySQL: `performance_schema.events_statements_summary_by_digest` | ✅ PG, MySQL, MariaDB 10.5+ |
| M9 | **Cache Hit Ratio** | Track buffer cache hit ratio (< 95% = warning). PG: `pg_stat_bgwriter`, MySQL: `Innodb_buffer_pool_read_requests / Innodb_buffer_pool_reads` | ✅ All |
| M10 | **Connection Usage %** | Active connections vs `max_connections`. Alert kalo > 80%. PG: `SHOW max_connections`, MySQL: `@@max_connections` | ✅ All |
| M11 | **Storage Growth Projection** | Perkiraan growth storage S3/R2 berdasarkan data size history | — |
| M12 | **Top 10 Slowest Backups** | List backup dengan durasi terlama — potential problem indicator | ✅ All |
| M13 | **Backup Freshness Alert** | Highlight kalo database gak di-backup > 24h | ✅ All |

### P2 — Nice to Have (v2+)

| ID | Feature | Description |
|----|---------|-------------|
| M14 | **Disk Usage Monitoring** | Cek disk usage di database server (via query ke `pg_catalog.pg_stat_file` atau SSH/agent) |
| M15 | **Autovacuum / Optimizer Status** | PG: `pg_stat_user_tables` (dead tuples, last vacuum). MySQL: `information_schema.OPTIMIZE_TABLE` |
| M16 | **Lock Detection** | PG: `pg_locks` — detect long-running locks / deadlocks. MySQL: `SHOW PROCESSLIST` |
| M17 | **Replication Lag** | Track replication delay untuk setup master-replica. PG: `pg_stat_replication`, MySQL: `SHOW SLAVE STATUS` |
| M18 | **Alert via Notification** | Kirim alert ke Telegram/Discord kalo health check failed atau metrics breached threshold |
| M19 | **Custom Monitoring Interval** | User bisa atur interval per connection (5m/15m/30m/1h) |
| M20 | **Table-Level Metrics** | PG: top 10 biggest tables, dead tuple ratio. MySQL: top 10 tables by data + index size |

---

## 5. Data Model — Monitoring Tables (TimescaleDB Hypertables)

### health_checks

```sql
CREATE TABLE health_checks (
    time            TIMESTAMPTZ NOT NULL,
    connection_id   TEXT NOT NULL,
    database_server TEXT NOT NULL,        -- conn.name for display
    db_type         TEXT NOT NULL,        -- postgresql, mysql, mariadb
    is_up           BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    error_message   TEXT,
    active_connections INTEGER
);
SELECT create_hypertable('health_checks', 'time');

-- Compression: 7 days old → compressed (90%+ reduction)
ALTER TABLE health_checks SET (timescaledb.compress);
SELECT add_compression_policy('health_checks', INTERVAL '7 days');

-- Retention: 90 days → auto-delete
SELECT add_retention_policy('health_checks', INTERVAL '90 days');

-- Index for dashboard query
CREATE INDEX idx_health_conn_time ON health_checks (connection_id, time DESC);
```

### db_size_metrics

```sql
CREATE TABLE db_size_metrics (
    time            TIMESTAMPTZ NOT NULL,
    connection_id   TEXT NOT NULL,
    database_name   TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    size_change_bytes BIGINT           -- delta from last check
);
SELECT create_hypertable('db_size_metrics', 'time');
ALTER TABLE db_size_metrics SET (timescaledb.compress);
SELECT add_compression_policy('db_size_metrics', INTERVAL '7 days');
SELECT add_retention_policy('db_size_metrics', INTERVAL '90 days');
CREATE INDEX idx_size_conn_db_time ON db_size_metrics (connection_id, database_name, time DESC);
```

### performance_metrics (v1.1+)

```sql
-- Slow queries / performance profiling
CREATE TABLE performance_metrics (
    time            TIMESTAMPTZ NOT NULL,
    connection_id   TEXT NOT NULL,
    metric_type     TEXT NOT NULL,    -- slow_queries, cache_hit_ratio, conn_usage_pct
    metric_name     TEXT NOT NULL,    -- e.g. "top_query_1", "buffer_hit_ratio"
    metric_value    DOUBLE PRECISION NOT NULL,
    metric_unit     TEXT NOT NULL,    -- ms, %, count
    detail_json     TEXT              -- JSON: query text, database name, etc.
);
SELECT create_hypertable('performance_metrics', 'time');
ALTER TABLE performance_metrics SET (timescaledb.compress);
SELECT add_compression_policy('performance_metrics', INTERVAL '7 days');
SELECT add_retention_policy('performance_metrics', INTERVAL '90 days');
CREATE INDEX idx_perf_conn_type_time ON performance_metrics (connection_id, metric_type, time DESC);

-- Cache hit ratio continuous aggregate (daily)
CREATE MATERIALIZED VIEW cache_hit_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', time) AS day,
       connection_id,
       avg(metric_value) FILTER (WHERE metric_type = 'cache_hit_ratio')::int AS avg_cache_hit_pct,
       min(metric_value) FILTER (WHERE metric_type = 'cache_hit_ratio')::int AS min_cache_hit_pct,
       avg(metric_value) FILTER (WHERE metric_type = 'conn_usage_pct')::int AS avg_conn_usage_pct,
       max(metric_value) FILTER (WHERE metric_type = 'conn_usage_pct')::int AS max_conn_usage_pct
FROM performance_metrics
WHERE metric_type IN ('cache_hit_ratio', 'conn_usage_pct')
GROUP BY day, connection_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('cache_hit_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

### Continuous Aggregate: Daily Rollup

```sql
CREATE MATERIALIZED VIEW health_checks_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', time) AS day,
       connection_id,
       count(*) AS total_checks,
       count(*) FILTER (WHERE is_up = false) AS failures,
       avg(response_time_ms)::int AS avg_response_ms,
       max(response_time_ms) AS max_response_ms,
       avg(active_connections)::int AS avg_connections,
       max(active_connections) AS max_connections
FROM health_checks
GROUP BY day, connection_id
WITH NO DATA;

-- Refresh every hour
SELECT add_continuous_aggregate_policy('health_checks_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
```

### Query Examples

```sql
-- Dashboard: health status for all connections (last 5 min)
SELECT h.connection_id, c.name, h.is_up, h.response_time_ms, h.active_connections
FROM health_checks h
JOIN connections c ON c.id = h.connection_id
WHERE h.time > now() - INTERVAL '5 minutes'
AND h.time = (SELECT MAX(time) FROM health_checks WHERE connection_id = h.connection_id);

-- Size growth trend (last 30 days, daily)
SELECT time_bucket('1 day', time) AS day,
       database_name,
       last(size_bytes, time) AS latest_size,
       first(size_bytes, time) AS size_30d_ago,
       last(size_bytes, time) - first(size_bytes, time) AS growth_bytes
FROM db_size_metrics
WHERE time > now() - INTERVAL '30 days'
GROUP BY day, database_name;

-- Backup duration trend (last 7 days)
SELECT time_bucket('1 hour', started_at) AS hour,
       connection_id,
       avg(duration_ms)::int AS avg_duration_ms
FROM backups
WHERE started_at > now() - INTERVAL '7 days'
  AND status = 'success'
GROUP BY hour, connection_id
ORDER BY hour;
```

---

## 6. Architecture — Monitoring Collector

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Backupeer Scheduler                        │
│                                                               │
│  ┌─────────────────────┐   ┌──────────────────────────────┐  │
│  │  Backup Cron Jobs    │   │  Monitoring Collector (NEW)  │  │
│  │  (existing, jadwal   │   │  ┌────────────────────────┐ │  │
│  │   backup sesuai cron)│   │  │ health_collector()     │ │  │
│  └─────────────────────┘   │  │   → ping setiap DB      │ │  │
│                             │  │   → INSERT health_check │ │  │
│  ┌─────────────────────┐   │  ├────────────────────────┤ │  │
│  │  Backup Service      │   │  │ size_collector()       │ │  │
│  │  (existing)          │   │  │   → query size         │ │  │
│  └─────────┬───────────┘   │  │   → INSERT db_metrics   │ │  │
│            │               │  └────────────────────────┘ │  │
│            ▼               └──────────────────────────────┘  │
│  ┌─────────────────┐                    │                     │
│  │   TimescaleDB    │◀───────────────────┘                     │
│  │   (unified DB)   │                                         │
│  └────────┬────────┘                                          │
│           │                                                    │
│           ▼                                                    │
│  ┌─────────────────┐                                          │
│  │  API + Web UI   │  GET /api/monitoring/status              │
│  │  (existing)     │  GET /api/monitoring/size-trend          │
│  └─────────────────┘  GET /api/monitoring/summary             │
└─────────────────────────────────────────────────────────────┘
```

### Monitoring Collector Design

```go
// internal/monitoring/collector.go
type Collector struct {
    connRepo  connection.Repository
    monitorDB *sql.DB           // ke TimescaleDB (sama kayak config DB)
    interval  time.Duration     // default 5 menit
}

func (c *Collector) Run(ctx context.Context) {
    ticker := time.NewTicker(c.interval)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            c.collectHealthChecks()
            c.collectDbSizes()    // every hour
            c.collectBackupMetrics() // on demand
        }
    }
}

func (c *Collector) collectHealthChecks() {
    conns, _ := c.connRepo.List()

    for _, conn := range conns {
        start := time.Now()
        err := connection.TestConnection(&conn)
        elapsed := time.Since(start).Milliseconds()

        // INSERT ke health_checks hypertable
        c.monitorDB.Exec(`
            INSERT INTO health_checks
            (time, connection_id, database_server, db_type, is_up, response_time_ms, error_message)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            time.Now(), conn.ID, conn.Name, conn.DBType,
            err == nil, elapsed, errorMessage(err))
    }
}
```

**Key design decisions:**
- Collector jalan sebagai **goroutine** di proses Backupeer yang sama (gak perlu service terpisah)
- Interval default: health check tiap 5 menit, size check tiap 1 jam
- Pake `context.Context` — pas graceful shutdown, collector stop with all pending writes complete
- **Gak ada impact ke backup pipeline** — collection dan backup jalan di goroutine terpisah

---

## 7. Non-Functional Requirements

| Aspect | Target | Notes |
|--------|--------|-------|
| **Monitoring data retention** | 90 days | TimescaleDB `add_retention_policy()` |
| **Health check interval** | 5 menit | Configurable nanti |
| **Size check interval** | 1 jam | Gak perlu terlalu sering — growth lambat |
| **Response time threshold** | < 500ms normal, > 2s warning | Database server health |
| **Dashboard query speed** | < 2 detik untuk range 30 hari | TimescaleDB continuous aggregate |
| **Memory impact** | < 10MB tambahan | Collector goroutine + koneksi pool |
| **Migration downtime** | < 5 menit | pgloader dari SQLite → TimescaleDB |
| **TimescaleDB storage overhead** | ~100MB untuk 90 hari data | 15 connections × 5 menit × 90 hari |
| **CGO requirement** | Hilang! | `lib/pq` gak butuh CGO — build lebih simpel |

---

## 8. Migration Plan — SQLite → TimescaleDB

### Phase 1: Backend Rewrite (Est: 2 hari)

| Task | File | Effort |
|------|------|--------|
| Add `BACKUPEER_DB_URL` config | `internal/config/config.go` | ⭐ 15 menit |
| Create PostgreSQL repository implementations | `internal/repository/*.go` | ⭐⭐⭐ 6-8 jam |
| Replace `go-sqlite3` with `lib/pq` in go.mod | `go.mod` | ⭐ 15 menit |
| Update migration system (SQLite → PostgreSQL syntax) | `internal/repository/db.go` | ⭐⭐ 2 jam |
| Update Dockerfile — remove CGO dep | `Dockerfile` | ⭐ 15 menit |
| Update docker-compose — add TimescaleDB service | `docker-compose.yml` | ⭐ 30 menit |
| Migration script (pgloader or export/import) | `scripts/migrate-sqlite-to-pg.sh` | ⭐ 1 jam |

### Phase 2: Monitoring Collector (Est: 2 hari)

| Task | File | Effort |
|------|------|--------|
| Monitoring schema (hypertable migration) | `internal/monitoring/schema.go` | ⭐ 30 menit |
| Collector service | `internal/monitoring/collector.go` | ⭐⭐ 3 jam |
| API endpoints (GET /api/monitoring/*) | `internal/monitoring/handler.go` | ⭐ 1 jam |
| Register routes | `internal/api/router.go` | ⭐ 15 menit |
| Scheduler integration | `internal/schedule/service.go` | ⭐ 1 jam |

### Phase 3: Web UI Dashboard (Est: 1-2 hari)

| Task | Files | Effort |
|------|-------|--------|
| Monitoring page (health grid) | `web/js/monitoring.js` | ⭐⭐ 3 jam |
| Size trend chart (Chart.js) | `web/js/charts.js` | ⭐ 2 jam |
| Connection status badge | `web/js/connections.js` | ⭐ 1 jam |
| Backup analytics dashboard | `web/js/analytics.js` | ⭐ 2 jam |

### Total Timeline: **~5-7 hari kerja**

---

## 9. Rollback Strategy

Kalau monitoring atau migration bermasalah:

| Skenario | Action | Downtime |
|----------|--------|----------|
| **Monitoring collector error** | Stop goroutine, matikan `/api/monitoring/*` | 0 — backup tetap jalan |
| **TimescaleDB connection lost** | Backupeer pake connection pool — auto reconnect | 0 — retry 5x lalu error log |
| **TimescaleDB corrupt** | Restore dari `pg_dump` backup | < 10 menit |
| **SQLite → TimescaleDB migration gagal** | Container tetap pake SQLite volume lama | 0 — rollback env, gausa deploy ulang |
| **Performance degradation** | Monitoring collector punya circuit breaker — mati sendiri kalo DB slow | 0 |

---

## 10. Design Inspiration — pgbadger

[pgbadger](https://github.com/darold/pgbadger) adalah PostgreSQL log analyzer berbasis Perl yang udah 13 tahun dipake production. Approach-nya:

```
PostgreSQL log → pgbadger → static HTML report (charts + analysis)
```

### Apa yang Kita Ambil dari pgbadger

Kita **tidak meniru arsitektur** pgbadger (log-based, post-mortem, Perl, static HTML) — karena Backupeer real-time, API-based, dan multi-DB. Tapi kita **ambil validated metric set**-nya:

| pgbadger Feature | Approach-nya | Backupeer Approach | Layer |
|-----------------|-------------|-------------------|-------|
| **Queries** | Parse log → top N slow queries | Query `pg_stat_statements` / `performance_schema` langsung | Layer 2 |
| **Connections** | Parse log → session duration | Query `pg_stat_activity` / `SHOW PROCESSLIST` | Layer 1+2 |
| **Locks** | Parse log → lock waits | Query `pg_locks` / `SHOW PROCESSLIST` | Layer 2 |
| **Temp files** | Parse log → disk usage | ❌ Butuh log parsing — skip v1 |
| **Checkpoints** | Parse log → frequency | Query `pg_stat_bgwriter` | Layer 2 |
| **Autovacuum** | Parse log → vacuum activity | Query `pg_stat_user_tables` | Layer 2 |
| **Cache hit ratio** | Kalkulasi dari log → hit/miss | Query `pg_stat_bgwriter` / InnoDB status | Layer 1 |

### Kenapa Gak Pake Log Parsing

| Alasan | Detail |
|--------|--------|
| **Log format beda-beda** | PostgreSQL syslog vs csvlog vs stderr — format berubah tiap major version. MySQL punya slow query log sendiri lagi |
| **Log must be enabled** | Banyak server gak aktifin logging detail (performance hit) |
| **Gak real-time** | Log-based = post-mortem. Kita mau live metrics |
| **Storage** | Log gede banget — parsing + storing > langsung query view |
| **MySQL/MariaDB** | Gak ada tool sebagus pgbadger untuk MySQL — jadi pendekatan query langsung lebih portable |

### Untuk MySQL/MariaDB Equivalent

| Tool | DB | Approach | Status |
|------|----|----------|--------|
| **pt-query-digest** (Percona) | MySQL | Baca slow query log → report | ❌ Post-mortem |
| **mysql-report** | MySQL | Mirip pgbadger | ❌ Post-mortem |
| **performance_schema** | MySQL 8+ | Built-in query views | ✅ Sama kayak approach kita |

**Intinya:** Approach query langsung ke `performance_schema` (MySQL) / `pg_stat_*` (PG) **lebih portable** daripada log parsing — satu kode collector kerja buat semua DB.

## 11. Two-Layer Monitoring Strategy

```
Layer 1: Server Health (P0 — v1.0)
├── Connection health check (ping + latency)
├── Database size tracking
├── Active connections count
└── Collection: tiap 5 menit, low overhead

Layer 2: Performance Profiling (P1 — v1.1)
├── Slow queries detection
├── Cache hit ratio
├── Connection usage %
├── Checkpoint / bgwriter stats
└── Collection: tiap 1 jam, read-only queries ke system views
```

**Kenapa dipisah:**
- Layer 1 aman di semua DB version (butuh akses minimal)
- Layer 2 butuh extensions (`pg_stat_statements`) atau MySQL 8+ (`performance_schema`)
- Layer 1 gak mungkin fail — SELECT 1 doang
- Layer 2 bisa partial: kalo `pg_stat_statements` gak available, skip slow query tapi cache hit ratio tetap jalan

## 12. Related Documents

- [PRD (existing)](./PRD.md) — Backupeer core PRD
- [DESIGN.md](../DESIGN.md) — Brand & design system
- [Architecture: Encryption & Verification](../site/architecture/security.md)
