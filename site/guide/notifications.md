---
title: 'Notifications'
description: 'Configure multi-channel notifications in Backupeer — Telegram, Discord, Slack, email, and webhook setup instructions with examples.'
---

# Notifications

Backupeer supports multi-channel notifications to keep you informed about backup results. You can receive alerts on success, failure, or both — delivered through your preferred messaging platforms.

## Supported Channels

| Channel | Type Identifier | Auth Method | Best For |
|---------|----------------|-------------|----------|
| Telegram | `telegram` | Bot token + Chat ID | Personal and team alerts |
| Discord | `discord` | Webhook URL | Team channels |
| Slack | `slack` | Webhook URL | Corporate communication |
| Email | `email` | SMTP credentials | Traditional alerting |
| Webhook | `webhook` | Custom URL | Custom integrations |

## Notification Configuration

Notification targets are defined in the `notifications` section of your config file:

```yaml
notifications:
  - name: my-telegram-alerts
    type: telegram
    config:
      bot_token: "${TELEGRAM_BOT_TOKEN}"
      chat_id: "-1001234567890"

  - name: my-discord-channel
    type: discord
    config:
      webhook_url: "${DISCORD_WEBHOOK_URL}"

  - name: my-slack-channel
    type: slack
    config:
      webhook_url: "${SLACK_WEBHOOK_URL}"
```

Each schedule then references the notification target(s):

```yaml
schedules:
  - name: nightly-full
    connection: production-postgres
    database: myapp_production
    backup_type: full
    cron_expr: "0 2 * * *"
    notify_on_success: true     # Send notification when backup succeeds
    notify_on_failure: true     # Send notification when backup fails
    notifications:
      - my-telegram-alerts
      - my-slack-channel
```

## Telegram

### Setup Steps

1. **Create a bot** — Message [@BotFather](https://t.me/BotFather) on Telegram and create a new bot with `/newbot`
2. **Get the bot token** — BotFather will give you a token like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`
3. **Get your chat ID** — Start a chat with your bot, send `/start`, then visit:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Look for the `chat.id` field in the response. For group chats, the ID will be negative.

### Configuration

```yaml
notifications:
  - name: ops-telegram
    type: telegram
    config:
      bot_token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
      chat_id: "-1001234567890"     # Negative for groups
```

### Message Format

Telegram messages are formatted with Markdown:

```
✅ BACKUP SUCCESS
Database: `myapp_production` (postgresql)
Size: 523.4 KB
Duration: 3.2 sec
Backup ID: `bkp_abc123`
```

Or for failures:

```
❌ BACKUP FAILED
Database: `myapp_production` (postgresql)
Size: —
Duration: 5.1 sec
Backup ID: `bkp_def456`

ERROR: connection refused
```

## Discord

### Setup Steps

1. Go to your Discord server
2. Open **Server Settings** → **Integrations** → **Webhooks**
3. Click **Create Webhook**
4. Name it (e.g., "Backupeer Backup Alerts") and select the channel
5. Click **Copy Webhook URL**

The URL looks like:
```
https://discord.com/api/webhooks/1234567890/ABCDefghijklmnopQRSTUVWXYZ
```

### Configuration

```yaml
notifications:
  - name: monitor-discord
    type: discord
    config:
      webhook_url: "https://discord.com/api/webhooks/1234567890/ABCDefghijklmnopQRSTUVWXYZ"
```

### Message Format

Discord webhook messages use a similar format with bold text:

```
✅ BACKUP SUCCESS
Database: myapp_production (postgresql)
Size: 523.4 KB
Duration: 3.2 sec
Backup ID: bkp_abc123
```

## Slack

### Setup Steps

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Under **Incoming Webhooks**, toggle **Activate Incoming Webhooks**
3. Click **Add New Webhook to Workspace**
4. Select the channel to post to
5. Copy the Webhook URL

The URL looks like:
```
https://hooks.slack.com/services/T00/B00/xxxxx
```

### Configuration

```yaml
notifications:
  - name: admin-slack
    type: slack
    config:
      webhook_url: "https://hooks.slack.com/services/T00/B00/xxxxx"
```

### Message Format

Slack messages use mrkdwn formatting:

```
✅ BACKUP SUCCESS
Database: myapp_production (postgresql)
Size: 523.4 KB
Duration: 3.2 sec
Backup ID: bkp_abc123
```

## Email

### Setup Steps

1. Have an SMTP server ready (Gmail SMTP, SendGrid, AWS SES, or your own)
2. Get the SMTP credentials (host, port, username, password)
3. Configure the sender and recipient email addresses

### Configuration

```yaml
notifications:
  - name: admin-email
    type: email
    config:
      smtp_host: "smtp.gmail.com"
      smtp_port: 587
      smtp_username: "alerts@example.com"
      smtp_password: "${SMTP_PASSWORD}"
      from: "backupeer@example.com"
      to:
        - "admin@example.com"
        - "ops-team@example.com"
      subject_template: "[Backupeer] {{.Status}} - {{.Database}} ({{.DBType}})"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `smtp_host` | string | ✅ | SMTP server hostname |
| `smtp_port` | int | ✅ | SMTP server port (25, 465, 587) |
| `smtp_username` | string | ✅ | SMTP authentication username |
| `smtp_password` | string | ✅ | SMTP authentication password |
| `from` | string | ✅ | Sender email address |
| `to` | list | ✅ | List of recipient email addresses |
| `subject_template` | string | ❌ | Go template for email subject line |

## Webhook

### Setup Steps

1. Set up an HTTP endpoint that accepts JSON POST requests
2. Configure the URL in Backupeer

### Configuration

```yaml
notifications:
  - name: custom-webhook
    type: webhook
    config:
      url: "https://hooks.example.com/backup-alerts"
      headers:
        Authorization: "Bearer ${WEBHOOK_SECRET}"
        X-Source: "backupeer"
      method: "POST"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | HTTP endpoint URL |
| `headers` | object | ❌ | Custom HTTP headers (key-value pairs) |
| `method` | string | ❌ | HTTP method (default: `POST`) |

### Webhook Payload Format

The webhook sends a JSON payload:

```json
{
  "event": "backup.completed",
  "backup_id": "bkp_abc123",
  "database": "myapp_production",
  "db_type": "postgresql",
  "status": "success",
  "size_bytes": 535940,
  "duration_ms": 3240,
  "backup_type": "full",
  "storage_path": "backups/production-db/myapp_production/bkp_abc123-20260101-020000.sql.gz",
  "started_at": "2026-01-01T02:00:01Z",
  "completed_at": "2026-01-01T02:00:05Z",
  "log_tail": "BACKUP: streaming postgresql myapp_production\nDUMP: pg_dump started\n..."
}
```

## Multiple Notification Targets

A schedule can send alerts to multiple channels simultaneously:

```yaml
schedules:
  - name: nightly-full
    connection: production-postgres
    database: myapp_production
    backup_type: full
    cron_expr: "0 2 * * *"
    notify_on_success: true
    notify_on_failure: true
    notifications:
      - ops-telegram
      - admin-slack
      - monitor-discord
      - admin-email
```

## Per-Channel Notification Settings

You can control notifications independently for success and failure:

```yaml
notify_on_success: false    # Don't notify on success (reduces noise)
notify_on_failure: true     # Always notify on failure
```

Typical setups:
- **Production**: `notify_on_failure: true` only (avoid noise from successful backups)
- **Critical databases**: Both `notify_on_success: true` and `notify_on_failure: true`
- **Development**: Both disabled, or just `notify_on_failure: true`

## Notification Content

Backup notifications include:

- **Emoji indicator**: ✅ for success, ❌ for failure
- **Database name** and type (PostgreSQL, MySQL, MariaDB)
- **Backup size** in human-readable format (KB, MB, GB)
- **Duration** in human-readable format (ms, sec, min)
- **Backup ID** for reference
- **Log excerpt** (tail of backup log, up to 500 characters, only on failure)

## Troubleshooting

**Notifications not sending?** Check these common issues:

| Issue | Check |
|-------|-------|
| Bot token invalid | Verify the bot token with @BotFather |
| Chat ID wrong | Send a message to your bot first, then check `/getUpdates` |
| Webhook URL expired | Discord/Slack webhooks can be revoked — regenerate |
| Network blocked | Ensure Backupeer can reach the API endpoints (no firewall/proxy issues) |
| Rate limited | Telegram/Discord have rate limits; Backupeer sends sequentially |
| SMTP auth failure | Double-check SMTP username and password |
| Schedule not linked | Verify `notifications` list references the correct target names |
| Notify flags disabled | Check `notify_on_success` and `notify_on_failure` are set to `true` |
