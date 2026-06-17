---
title: 'API Reference'
description: 'REST API endpoints: /api/backups, /api/connections, /api/schedules, /api/health, and all other endpoints'
---

# API Reference

Jagad provides a comprehensive REST API for managing database connections, backups, schedules, restores, storage providers, notifications, and settings. All API endpoints return JSON responses.

## Base URL

```
http://localhost:8080
```

## Authentication

Most API endpoints require authentication. Authentication is handled via **session tokens**.

### Login

```
POST /api/auth/login
```

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "abc123def456...",
  "user": "admin"
}
```

The token is also set as an `HttpOnly` cookie named `session`.

### Authentication Methods

**Cookie** (auto-handled by browser):

```
Cookie: session=abc123def456...
```

**Authorization header** (for API clients):

```
Authorization: abc123def456...
```

### Logout

```
POST /api/auth/logout
```

**Response:**
```json
{
  "success": true
}
```

### Check Session

```
GET /api/auth/check
```

**Response (authenticated):**
```json
{
  "user": "admin",
  "expires": "2025-01-02T02:00:00Z"
}
```

**Response (unauthenticated):** `401 Unauthorized`

### Change Password

```
PUT /api/auth/password
```

**Request:**
```json
{
  "current_password": "admin123",
  "new_password": "new-password-123"
}
```

**Response:**
```json
{
  "success": true
}
```

> **Note**: Changing the password invalidates all existing sessions.

## Health

```
GET /api/health
```

**Authentication**: None (public)

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "encryption": true,
  "providers": true,
  "legacy_storage": false
}
```

## Connections

### List Connections

```
GET /api/connections
```

**Response:**
```json
[
  {
    "id": "conn_abc123",
    "name": "Production PG",
    "db_type": "postgresql",
    "host": "db.example.com",
    "port": 5432,
    "username": "backup_user",
    "ssl_mode": "prefer",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

> Password is omitted from API responses.

### Create Connection

```
POST /api/connections
```

**Request:**
```json
{
  "name": "Production PG",
  "db_type": "postgresql",
  "host": "db.example.com",
  "port": 5432,
  "username": "backup_user",
  "password": "secret-password",
  "ssl_mode": "prefer"
}
```

**Response:** `201 Created`

### Get Connection

```
GET /api/connections/{id}
```

### Update Connection

```
PUT /api/connections/{id}
```

### Delete Connection

```
DELETE /api/connections/{id}
```

**Response:** `204 No Content`

### Test Connection

```
POST /api/connections/{id}/test
POST /api/connections/_new/test    # Test before saving
```

**Response:**
```json
{
  "success": true
}
```

### List Databases

```
GET /api/connections/{id}/databases
```

### Discover Databases

```
POST /api/connections/{id}/discover
```

Discovers databases on the server and returns them.

### Update Database Selection

```
PUT /api/connections/databases/{id}
```

**Request:**
```json
{
  "is_selected": true
}
```

**Response:** `204 No Content`

## Backups

### List Backups

```
GET /api/backups?connection_id=&database_id=&limit=50&offset=0
```

**Response:**
```json
[
  {
    "id": "bck_abc123",
    "connection_id": "conn_abc123",
    "database_id": "db_abc123",
    "schedule_id": "sch_abc123",
    "backup_type": "full",
    "status": "success",
    "storage_path": "backups/Production PG/mydb/bck_abc123-20250101-020000.sql.gz",
    "storage_provider_id": "prov_abc123",
    "size_bytes": 4294967296,
    "encrypted_size_bytes": 4345298944,
    "encryption_algo": "AES-256-GCM",
    "checksum": "abc123def456...",
    "verify_status": "passed",
    "duration_ms": 128000,
    "log_output": "BACKUP: streaming postgresql mydb\n...",
    "started_at": "2025-01-01T02:00:00Z",
    "completed_at": "2025-01-01T02:02:08Z",
    "created_at": "2025-01-01T02:00:00Z"
  }
]
```

### Create Backup (One-Shot)

```
POST /api/backups
```

**Request:**
```json
{
  "connection_id": "conn_abc123",
  "database_id": "db_abc123",
  "backup_type": "full",
  "schedule_id": "sch_abc123",
  "storage_provider_id": "prov_abc123",
  "notif_target_ids": ["notif_abc123"],
  "notify_on_success": true,
  "notify_on_failure": true
}
```

**Response:** `201 Created`

### Get Backup

```
GET /api/backups/{id}
```

### Delete Backup

```
DELETE /api/backups/{id}
```

**Response:** `204 No Content`

### Get Backup Logs

```
GET /api/backups/{id}/logs
```

**Response:**
```json
{
  "log": "BACKUP: streaming postgresql mydb\nDUMP: postgresql started\n..."
}
```

### Download Backup

```
GET /api/backups/{id}/download
```

**Response**: Binary stream (`Content-Type: application/octet-stream`)

### Verify Backup

```
POST /api/backups/{id}/verify
```

Triggers async integrity verification (SHA-256 checksum comparison).

**Response:**
```json
{
  "status": "verifying",
  "backup_id": "bck_abc123"
}
```

### Backup Stats

```
GET /api/backups/stats
```

**Response:**
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

### Restore from Backup

```
POST /api/backups/{id}/restore
```

**Request:**
```json
{
  "target_connection": "conn_xyz789"
}
```

**Response:** `201 Created`
```json
{
  "id": "res_abc123",
  "backup_id": "bck_abc123",
  "target_connection": "conn_xyz789",
  "status": "running",
  "started_at": "2025-01-01T03:00:00Z",
  "created_at": "2025-01-01T03:00:00Z"
}
```

## Restores

### List Restores

```
GET /api/restores
```

### Get Restore

```
GET /api/restores/{id}
```

## Schedules

### List Schedules

```
GET /api/schedules
GET /api/schedules?connection_id=conn_abc123
```

**Response:**
```json
[
  {
    "id": "sch_abc123",
    "connection_id": "conn_abc123",
    "database_id": "db_abc123",
    "backup_type": "full",
    "cron_expr": "0 2 * * *",
    "storage_provider_id": "prov_abc123",
    "encryption_enabled": true,
    "verify_enabled": true,
    "retention_full": 7,
    "retention_incr": 30,
    "notif_target_ids": ["notif_abc123"],
    "notify_on_success": true,
    "notify_on_failure": true,
    "enabled": true,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

### Create Schedule

```
POST /api/schedules
```

**Request:**
```json
{
  "connection_id": "conn_abc123",
  "database_id": "db_abc123",
  "backup_type": "full",
  "cron_expr": "0 2 * * *",
  "storage_provider_id": "prov_abc123",
  "encryption_enabled": true,
  "verify_enabled": true,
  "retention_full": 7,
  "retention_incr": 30,
  "notif_target_ids": ["notif_abc123"],
  "notify_on_success": true,
  "notify_on_failure": true
}
```

**Response:** `201 Created`

### Get Schedule

```
GET /api/schedules/{id}
```

### Update Schedule

```
PUT /api/schedules/{id}
```

### Delete Schedule

```
DELETE /api/schedules/{id}
```

**Response:** `204 No Content`

### Run Schedule Now

```
POST /api/schedules/{id}/run
```

Triggers an immediate backup run for this schedule, bypassing the cron timer.

**Response:**
```json
{
  "status": "triggered",
  "schedule_id": "sch_abc123"
}
```

## Storage Providers

### List Storage Providers

```
GET /api/storage-providers
```

**Response:**
```json
[
  {
    "id": "prov_abc123",
    "name": "AWS S3",
    "provider_type": "s3",
    "endpoint": "https://s3.us-east-1.amazonaws.com",
    "region": "us-east-1",
    "bucket": "my-backups",
    "access_key": "AKIA...",
    "secret_key": "••••••",
    "path_style": false,
    "is_default": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

> Secret keys are masked in API responses.

### Create Storage Provider

```
POST /api/storage-providers
```

**Request:**
```json
{
  "name": "AWS S3",
  "provider_type": "s3",
  "endpoint": "https://s3.us-east-1.amazonaws.com",
  "region": "us-east-1",
  "bucket": "my-backups",
  "access_key": "AKIA...",
  "secret_key": "...",
  "path_style": false,
  "is_default": true
}
```

**Response:** `201 Created`

### Get Storage Provider

```
GET /api/storage-providers/{id}
```

### Update Storage Provider

```
PUT /api/storage-providers/{id}
```

### Delete Storage Provider

```
DELETE /api/storage-providers/{id}
```

**Response:** `204 No Content`

### Test Storage Provider

```
POST /api/storage-providers/{id}/test
```

Tests connectivity by checking if the bucket exists.

**Response:**
```json
{
  "success": true,
  "message": "Connection successful"
}
```

### Set Default Provider

```
POST /api/storage-providers/{id}/set-default
```

## Notifications

### List Notification Targets

```
GET /api/notifications
```

### Create Notification Target

```
POST /api/notifications
```

**Request:**
```json
{
  "name": "My Telegram",
  "notif_type": "telegram",
  "config_json": "{\"bot_token\":\"123:ABC\",\"chat_id\":\"123\"}"
}
```

Supported `notif_type` values: `telegram`, `discord`, `slack`.

### Get Notification Target

```
GET /api/notifications/{id}
```

### Update Notification Target

```
PUT /api/notifications/{id}
```

### Delete Notification Target

```
DELETE /api/notifications/{id}
```

**Response:** `204 No Content`

### Test Notification

```
POST /api/notifications/{id}/test
```

Sends a test notification to verify the channel works.

**Response:**
```json
{
  "status": "sent"
}
```

## Settings

### Get All Settings

```
GET /api/settings
```

**Response:**
```json
{
  "retention_full_default": "7",
  "retention_incr_default": "30",
  "concurrent_backups": "3",
  "compression": "gzip",
  "timezone": "UTC",
  "notify_on_success": "true",
  "notify_on_failure": "true",
  "version": "1.0.0"
}
```

### Update Settings

```
PUT /api/settings
```

**Request:**
```json
{
  "retention_full_default": "14",
  "concurrent_backups": "5"
}
```

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "connection not found"
}
```

**HTTP Status Codes:**

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (deletion success) |
| `400` | Bad Request (invalid input) |
| `401` | Unauthorized (missing/invalid session) |
| `404` | Not Found |
| `500` | Internal Server Error |

## Rate Limiting

There is currently no built-in rate limiting. Use a reverse proxy (nginx, Caddy) for production deployments.
