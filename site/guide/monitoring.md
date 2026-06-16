---
title: 'Monitoring'
description: 'Web UI dashboard, health checks, backup logs, Prometheus metrics, and alert thresholds'
---

# Monitoring

Backupeer provides several ways to monitor backup operations, system health, and receive alerts. From the built-in Web UI dashboard to API-based health checks and multi-channel notifications.

## Web UI Dashboard

The Backupeer Web UI features a Stripe-inspired dashboard with real-time monitoring capabilities.

### Dashboard Sections

**Backup Statistics**
- Total backups performed
- Total data backed up (bytes)
- Success rate percentage
- Breakdown by backup type (full vs incremental)
- Breakdown by status (success, failed, running, verifying)

**Recent Backups**
- Last 50 backups with status indicators
- Quick-view of logs
- Direct access to restore and verify actions

**Active Schedules**
- Currently enabled schedules with next run time
- Schedule status indicators
- Quick enable/disable toggle

**Storage Overview**
- Connected storage providers
- Default provider indicator
- Connection health

### Accessing the Dashboard

The Web UI is served automatically when the Backupeer server is running:

```
http://localhost:8080/
```

Login with your admin credentials (default: `admin` / `admin123`).

## Health Check

Backupeer exposes a health check endpoint that provides system status in JSON format.

```
GET /api/health
```

**Authentication**: None (public endpoint)

**Response**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "encryption": true,
  "providers": true,
  "legacy_storage": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"ok"` if the server is running |
| `version` | string | Build version of Backupeer |
| `encryption` | boolean | Whether data encryption is enabled |
| `providers` | boolean | Whether storage providers are configured via UI |
| `legacy_storage` | boolean | Whether legacy env-based storage is configured |

### Uptime Monitoring

You can use the health endpoint with external monitoring services like **UptimeRobot**, **Pingdom**, **Checkly**, or **Grafana**:

```bash
# Simple health check
curl http://localhost:8080/api/health

# Use with exit code for shell scripts
curl --fail http://localhost:8080/api/health && echo "Backupeer is healthy"
```

## Backup Logs

Every backup operation records detailed logs that are stored in the database and accessible via UI and API.

### Log Contents

- Timestamp of each operation step
- Database type and name
- Compression status and sizes
- Encryption status
- Upload destination (S3 bucket path)
- Any errors encountered

### Viewing Logs

#### Via UI
Click on any backup in the backups list to see its full log output.

#### Via API
```bash
# Get full backup details including logs
curl -H "Authorization: <session-token>" \
  http://localhost:8080/api/backups/<backup-id>

# Get logs only
curl -H "Authorization: <session-token>" \
  http://localhost:8080/api/backups/<backup-id>/logs
```

**Response**:
```json
{
  "log": "BACKUP: streaming postgresql mydb\nDUMP: postgresql started\nDUMP: 4294967296 bytes uncompressed\n"
}
```

### Log Level

Backupeer uses structured JSON logging via `slog` (Go's structured logging package). Logs are written to stdout and include:

```
time=2025-01-01T02:00:00.000Z level=INFO msg="starting backupeer" version=dev
time=2025-01-01T02:00:00.100Z level=INFO msg="encryption enabled (AES-256-GCM)"
time=2025-01-01T02:00:01.000Z level=INFO msg="scheduler started" active=3
```

## Prometheus Metrics

Backupeer can be integrated with the Prometheus monitoring ecosystem via the **aggregate stats API** endpoint.

```
GET /api/backups/stats
```

**Response**:
```json
{
  "total_backups": 150,
  "total_size_bytes": 1099511627776,
  "by_type": {
    "full": 50,
    "incremental": 100
  },
  "by_status": {
    "success": 145,
    "failed": 5
  },
  "success_rate": 96.67
}
```

### Integration with Prometheus

You can configure a **Prometheus exporter** or use **Grafana's JSON data source** to scrape and visualize these metrics.

Example Prometheus `scrape_config`:

```yaml
scrape_configs:
  - job_name: 'backupeer'
    metrics_path: '/api/backups/stats'
    static_configs:
      - targets: ['localhost:8080']
```

> **Note**: A dedicated Prometheus `/metrics` endpoint is on the roadmap. Currently, use the stats API with a Prometheus exporter or Grafana JSON API plugin.

## Alert Thresholds

Backupeer sends real-time alerts through configurable notification channels. Alerts are triggered based on backup results, not raw metrics.

### Alert Triggers

| Trigger | Condition | Delivery |
|---------|-----------|----------|
| Backup Success | Backup completes with status `success` | Per-schedule notification setting |
| Backup Failure | Backup completes with status `failed` | Per-schedule notification setting |
| Verification Failure | Checksum mismatch during verification | Manual trigger, logged |

### Notification Channels

#### Telegram
Configure a Telegram bot to receive backup alerts:

1. Create a bot via [@BotFather](https://t.me/botfather) and get the bot token
2. Get your chat ID (send a message to the bot, visit `https://api.telegram.org/bot<TOKEN>/getUpdates`)
3. Configure in Backupeer:
```json
{
  "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "chat_id": "123456789"
}
```

#### Discord
Set up a Discord webhook:

1. Go to Server Settings → Integrations → Webhooks
2. Create a webhook and copy the URL
3. Configure in Backupeer:
```json
{
  "webhook_url": "https://discord.com/api/webhooks/123456/ABC-DEF-123"
}
```

#### Slack
Set up a Slack webhook:

1. Go to Slack API → Incoming Webhooks
2. Create a webhook and copy the URL
3. Configure in Backupeer:
```json
{
  "webhook_url": "https://hooks.slack.com/services/T00/B00/XXXX"
}
```

### Setting Alert Thresholds via API

Notification targets can be associated with individual backup runs or schedules:

```bash
# Create a notification target
curl -X POST http://localhost:8080/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: <session-token>" \
  -d '{
    "name": "My Telegram",
    "notif_type": "telegram",
    "config_json": "{\"bot_token\":\"...\",\"chat_id\":\"...\"}"
  }'
```

### Testing Notifications

```bash
# Send a test notification
curl -X POST http://localhost:8080/api/notifications/<notif-id>/test \
  -H "Authorization: <session-token>"
```

## Application Settings

Global monitoring-related settings can be configured via the settings API:

```
GET /api/settings     # List all settings
PUT /api/settings     # Update settings
```

Available settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `retention_full_default` | int | `7` | Default full backup retention count |
| `retention_incr_default` | int | `30` | Default incremental backup retention count |
| `concurrent_backups` | int | `3` | Maximum concurrent backup operations |
| `compression` | string | `"gzip"` | Compression algorithm |
| `timezone` | string | `"UTC"` | Server timezone for scheduling |
| `notify_on_success` | bool | `true` | Default notification on success |
| `notify_on_failure` | bool | `true` | Default notification on failure |

## Grafana Dashboard Example

You can create a Grafana dashboard using the JSON API plugin to visualize:

- Total backups over time
- Success/failure ratio
- Backup size trends
- Active schedule count
- Storage utilization

Query the stats endpoint periodically and use Grafana's transformation features to build panels.
