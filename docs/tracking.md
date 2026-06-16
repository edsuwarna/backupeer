# Backupeer — Development Tracking

## Progress Dashboard

- [x] Project scaffold (Go module, Dockerfile, compose, etc.)
- [x] SQLite schema (connections, schedules, backups, restores, encryption_keys)
- [x] Connection CRUD + database discovery
- [x] Backup execution (pg_dump, mysqldump/mariadb-dump, gzip, encrypt)
- [x] S3 upload (MinIO SDK)
- [x] Restore pipeline (download, decrypt, decompress, restore)
- [x] Cron scheduler (robfig/cron)
- [x] Auth (session-based, Argon2id password)
- [x] Web UI (vanilla JS SPA, dark/light, responsive)

### v0.2.0 — Storage Provider UI + Test Connection

- [x] DB: `storage_providers` table + `storage_provider_id` on backups/schedules
- [x] Storage provider model + encryptor for credentials at rest (AES-256-GCM)
- [x] Storage provider repository (SQLite CRUD)
- [x] Storage provider service (CRUD + decrypt on read + test connection)
- [x] Storage provider API handler (list, create, get, update, delete, test, set-default)
- [x] Dynamic S3 client per provider (not global singleton)
- [x] Schedule updated: `StorageConfig` → `StorageProviderID`
- [x] Backup updated: stores `storage_provider_id`, resolves provider at runtime
- [x] Restore updated: resolves provider from backup record
- [x] S3Client: added `BucketExists()` for test connection
- [x] Web UI: Storage page (list, add, edit, delete, test, set default)
- [x] Web UI: Schedule form includes storage provider selector
- [x] Web UI: Backup modal includes storage provider selector
- [x] Web UI: Dashboard shows storage providers count
- [x] Build passes + API test (create, list, test, delete)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/check | Check auth |
| GET | /api/connections | List connections |
| POST | /api/connections | Create connection |
| GET | /api/connections/{id} | Get connection |
| DELETE | /api/connections/{id} | Delete connection |
| POST | /api/connections/{id}/discover | Discover databases |
| GET | /api/backups | List backups |
| POST | /api/backups | Create backup (manual run) |
| GET | /api/backups/{id} | Get backup |
| DELETE | /api/backups/{id} | Delete backup |
| GET | /api/backups/{id}/logs | Get backup logs |
| POST | /api/backups/{id}/restore | Restore backup |
| GET | /api/schedules | List schedules |
| POST | /api/schedules | Create schedule |
| PUT | /api/schedules/{id} | Update schedule |
| DELETE | /api/schedules/{id} | Delete schedule |
| POST | /api/schedules/{id}/run | Run schedule now |
| GET | /api/restores | List restores |
| **GET** | **/api/storage-providers** | **List storage providers** |
| **POST** | **/api/storage-providers** | **Create storage provider** |
| **GET** | **/api/storage-providers/{id}** | **Get storage provider** |
| **PUT** | **/api/storage-providers/{id}** | **Update storage provider** |
| **DELETE** | **/api/storage-providers/{id}** | **Delete storage provider** |
| **POST** | **/api/storage-providers/{id}/test** | **Test connection** |
| **POST** | **/api/storage-providers/{id}/set-default** | **Set as default** |

## Architecture

- Go backend, SQLite, MinIO S3 SDK
- Vanilla JS SPA (no framework)
- Docker + docker-compose
- AES-256-GCM encryption (backup data + credentials at rest)
- robfig/cron for scheduling

## Todo (Future)

- Retention policy enforcement (auto-delete old backups)
- Real-time log streaming via SSE
- GitHub Actions CI
- README + LICENSE
- End-to-end test with container database
