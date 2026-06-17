---
title: 'Quick Start'
description: 'Get started with Jagad in under 5 minutes — download the binary, configure your database connection, and run your first backup.'
---

# Quick Start

This guide will get you up and running with Jagad in under 5 minutes. By the end, you'll have a working backup from one of your databases stored in S3-compatible object storage.

## Prerequisites

Before you begin, make sure you have:

- A **database server** (PostgreSQL, MySQL, or MariaDB) accessible from your machine
- **S3-compatible storage** (AWS S3, Cloudflare R2, MinIO, etc.) with access key and secret key
- The database dump tool installed on your machine (`pg_dump`, `mysqldump`, or `mariadb-dump`)

## Step 1: Download Jagad

Download the latest binary for your platform.

**Linux (amd64):**
```bash
curl -L -o jagad https://github.com/edsuwarna/jagad/releases/latest/download/jagad-linux-amd64
chmod +x jagad
sudo mv jagad /usr/local/bin/
```

**macOS (arm64):**
```bash
curl -L -o jagad https://github.com/edsuwarna/jagad/releases/latest/download/jagad-darwin-arm64
chmod +x jagad
sudo mv jagad /usr/local/bin/
```

Verify the installation:
```bash
jagad version
# Should print version like: jagad v0.1.0
```

## Step 2: Create a Configuration File

Create a `jagad.yaml` configuration file. Here's a minimal example:

```yaml
# Database connection
connections:
  - name: production-db
    db_type: postgresql
    host: localhost
    port: 5432
    username: dbuser
    password: dbpassword
    ssl_mode: prefer

# Storage provider
storage:
  - name: my-s3
    provider_type: s3
    endpoint: https://s3.us-east-1.amazonaws.com
    region: us-east-1
    bucket: my-backups
    access_key: AKIAIOSFODNN7EXAMPLE
    secret_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
    path_style: false
    is_default: true

# Backup schedule
schedules:
  - name: nightly-full
    connection: production-db
    database: myapp_production
    backup_type: full
    cron_expr: "0 2 * * *"     # Run daily at 2 AM
    retention_full: 7           # Keep 7 full backups
    enabled: true
    storage: my-s3
```

> **💡 Tip:** The `backup_type: full` runs a logical dump (`pg_dump`/`mysqldump`). For incremental backups, see the Scheduling guide.

## Step 3: Run Your First Backup

Start Jagad in one-shot mode to run a backup immediately:

```bash
jagad backup --config jagad.yaml
```

Or specify everything inline:
```bash
jagad backup \
  --db-type postgresql \
  --db-host localhost \
  --db-port 5432 \
  --db-user dbuser \
  --db-password dbpassword \
  --db-name myapp_production \
  --storage-endpoint https://s3.us-east-1.amazonaws.com \
  --storage-region us-east-1 \
  --storage-bucket my-backups \
  --storage-access-key AKIAIOSFODNN7EXAMPLE \
  --storage-secret-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

You'll see output like:
```
[backup] Starting backup for myapp_production (postgresql)
[backup] DUMP: pg_dump started
[backup] DUMP: 1542387 bytes uncompressed
[backup] BACKUP COMPLETE: success
[backup]   Database:  myapp_production
[backup]   Type:      full
[backup]   Size:      523.4 KB (compressed)
[backup]   Duration:  3.2 sec
[backup]   Path:      backups/production-db/myapp_production/<backup-id>-20260101-020000.sql.gz
```

## Step 4: Start the Web UI (Optional)

Jagad includes a beautiful Stripe-inspired web dashboard. Start it with:

```bash
jagad serve --config jagad.yaml
```

Then open **http://localhost:8080** in your browser. From the dashboard you can:

- View backup history and metrics
- Manage database connections
- Configure schedules
- Set up notifications
- Monitor backup status in real-time

## Step 5: Set Up Scheduled Backups

Once you confirm manual backups work, let Jagad run on a schedule:

```bash
jagad daemon --config jagad.yaml
```

This runs the scheduler in the foreground. For production, use a process manager like systemd or run it as a Docker container.

## What's Next?

- Read the [Configuration Guide](./configuration.md) for all available options
- Learn about [Storage Providers](./storage-providers.md) for different backends
- Set up [Notifications](./notifications.md) to get alerted on backup results
- Explore [Scheduling & Retention](./scheduling.md) for automated backup policies
