---
title: 'Scheduling & Retention'
description: 'Configure cron-based backup schedules and retention policies in Jagad — cron expressions, retention tiers, and adaptive retention examples.'
---

# Scheduling & Retention

Jagad uses standard cron expressions for scheduling and supports configurable retention policies to automatically manage backup lifecycle.

## How Scheduling Works

Each schedule defines:
- A **database** to back up (via a connection)
- A **cron expression** for timing
- A **backup type** (full or incremental)
- A **storage provider** to upload to
- **Retention limits** for automatic cleanup
- **Notification targets** for alerts

The scheduler runs all active jobs using `robfig/cron` v3. After each backup completes, Jagad automatically enforces the retention policy — old backups beyond the configured limits are deleted.

## Cron Expressions

Jagad uses standard 5-field cron expressions:

```
┌───────── minute (0 - 59)
│ ┌──────── hour (0 - 23)
│ │ ┌─────── day of month (1 - 31)
│ │ │ ┌────── month (1 - 12)
│ │ │ │ ┌───── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │
* * * * *
```

### Common Examples

| Expression | Description |
|------------|-------------|
| `0 * * * *` | Every hour at minute 0 |
| `*/30 * * * *` | Every 30 minutes |
| `0 */6 * * *` | Every 6 hours |
| `0 2 * * *` | Daily at 2:00 AM |
| `0 2 * * 0` | Every Sunday at 2:00 AM |
| `0 2 1 * *` | 1st of every month at 2:00 AM |
| `0 2,14 * * *` | Twice daily at 2:00 AM and 2:00 PM |
| `*/5 * * * *` | Every 5 minutes (useful for testing) |

### Full + Incremental Scheduling Pattern

A typical production setup combines a daily full backup with hourly incrementals:

```yaml
schedules:
  # Daily full backup at 2 AM
  - name: nightly-full
    connection: production-postgres
    database: myapp_production
    backup_type: full
    cron_expr: "0 2 * * *"
    storage: aws-s3
    retention_full: 14
    notify_on_failure: true
    enabled: true

  # Hourly incremental during business hours
  - name: hourly-incr
    connection: production-postgres
    database: myapp_production
    backup_type: incremental
    cron_expr: "0 * * * *"
    storage: aws-s3
    retention_incr: 48
    notify_on_failure: true
    enabled: true
```

## Retention Policies

Retention determines how many backups are kept before automatic deletion. After each backup completes, Jagad deletes the oldest backups that exceed the configured limits.

### Retention Settings

| Setting | Scope | Default | Description |
|---------|-------|---------|-------------|
| `retention_full` | Per schedule | `7` | Number of full backups to retain |
| `retention_incr` | Per schedule | `30` | Number of incremental backups to retain |

### How Retention Enforcement Works

1. A backup completes successfully
2. Jagad counts existing backups for that schedule, grouped by type
3. If the count exceeds the retention limit, the oldest backups are deleted (from both metadata and S3)
4. Only backups belonging to the same schedule are considered

### Example: Retention in Action

With `retention_full: 7` and daily full backups:

```
Day 1:  backup-1 (saved)
Day 2:  backup-2 (saved)
Day 3:  backup-3 (saved)
Day 4:  backup-4 (saved)
Day 5:  backup-5 (saved)
Day 6:  backup-6 (saved)
Day 7:  backup-7 (saved)
Day 8:  backup-8 (saved) → backup-1 deleted (8 > 7)
Day 9:  backup-9 (saved) → backup-2 deleted
...
```

You always retain the 7 most recent full backups.

### Retention for Incremental Backups

Incremental retention works independently from full retention. With `retention_incr: 48` and hourly incrementals:

```
Hour 1:  incr-1 (saved)
Hour 2:  incr-2 (saved)
...
Hour 48: incr-48 (saved)
Hour 49: incr-49 (saved) → incr-1 deleted (49 > 48)
```

> **⚠️ Note:** When an incremental backup is deleted, it only removes that incremental's binary data. The base full backup remains intact. However, you must ensure the base full backup is still available to restore any remaining incremental that depends on it.

## Adaptive Retention (Multi-Tier)

For more sophisticated retention strategies, create multiple schedules for the same database with different cadences and retention values:

### Example: 3-Tier Retention

```yaml
# Tier 1: Hourly backups kept for 24 hours
- name: hourly-24h
  connection: production-postgres
  database: myapp_production
  backup_type: incremental
  cron_expr: "0 * * * *"
  retention_incr: 24
  enabled: true

# Tier 2: Daily backups kept for 30 days
- name: daily-30d
  connection: production-postgres
  database: myapp_production
  backup_type: full
  cron_expr: "0 2 * * *"
  retention_full: 30
  enabled: true

# Tier 3: Weekly backups kept for 12 months
- name: weekly-1y
  connection: production-postgres
  database: myapp_production
  backup_type: full
  cron_expr: "0 3 * * 0"
  retention_full: 52
  enabled: true

# Tier 4: Monthly backups kept for 3 years
- name: monthly-3y
  connection: production-postgres
  database: myapp_production
  backup_type: full
  cron_expr: "0 4 1 * *"
  retention_full: 36
  enabled: true
```

This gives you:
- **Rolling 24-hour** coverage at 1-hour granularity
- **30 daily** snapshots
- **52 weekly** snapshots
- **36 monthly** snapshots

### Using Different Storage for Each Tier

You can also route different tiers to different storage providers:

```yaml
storage:
  - name: aws-s3
    provider_type: s3
    endpoint: https://s3.us-east-1.amazonaws.com
    region: us-east-1
    bucket: hot-backups
    access_key: "${AWS_KEY}"
    secret_key: "${AWS_SECRET}"
    is_default: true

  - name: b2-cold
    provider_type: b2
    endpoint: https://s3.us-west-004.backblazeb2.com
    region: us-west-004
    bucket: cold-archive
    access_key: "${B2_KEY}"
    secret_key: "${B2_SECRET}"
    is_default: false

schedules:
  # Frequent backups to fast S3
  - name: hourly-incr
    cron_expr: "0 * * * *"
    storage: aws-s3
    retention_incr: 24
    # ...

  # Monthly archive to cheap B2
  - name: monthly-archive
    cron_expr: "0 4 1 * *"
    storage: b2-cold
    retention_full: 36
    # ...
```

## Disabling Schedules

Set `enabled: false` to temporarily disable a schedule without removing it:

```yaml
schedules:
  - name: maintenance-window
    connection: production-postgres
    database: myapp_production
    backup_type: full
    cron_expr: "0 2 * * *"
    enabled: false   # Disabled — will not run
```

## Manual Execution

You can trigger any schedule manually:

```bash
jagad run --schedule nightly-full --config jagad.yaml
```

This runs the backup immediately, bypassing the cron schedule, but still applies retention and notifications.

## Viewing Schedule Status

The Web UI shows all schedules with:
- **Next run time** — when the next backup is scheduled
- **Last run** — status and duration of the last backup
- **Active/Disabled** — whether the schedule is enabled
- **Retention status** — current backup counts vs limits

## Best Practices

1. **Start with full backups** — verify they work before adding incrementals
2. **Set realistic retention** — don't keep more backups than you need; storage costs add up
3. **Always retain at least 2 full backups** — in case one is corrupted during restore
4. **Test retention enforcement** — manually trigger a schedule and verify old backups are cleaned up
5. **Use different storage tiers** — fast storage for daily operations, cold storage for monthly archives
6. **Stagger schedules** — avoid running all backups at exactly the same time to prevent resource contention
7. **Monitor failures** — always enable `notify_on_failure` for production schedules
