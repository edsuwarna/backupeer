---
title: 'Security Model'
---

# Security Model

Backupeer is designed with a defense-in-depth approach to security, protecting backup data at every stage: at rest in the local database, in transit over the network, and at rest in S3-compatible object storage.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Security Layers                               │
│                                                                     │
│  1. In Transit (TLS)                   ┌────────────────────────┐   │
│     ┌──────────┐   HTTPS   ┌──────────┐│  S3/API over HTTPS     │   │
│     │ Browser  │──────────▶│ Backend  ││  (TLS 1.2+ mandatory)  │   │
│     └──────────┘           └──────────┘│                        │   │
│                                        │  SQLite (local)        │   │
│  2. Authentication                     │  ┌──────────────────┐  │   │
│     ┌───────────────┐                  │  │ Encrypted at     │  │   │
│     │ Session-based  │                  │  │ rest (credentials)│  │   │
│     │ + HttpOnly     │                  │  └──────────────────┘  │   │
│     │   cookies      │                  └────────────────────────┘   │
│     └───────────────┘                                               │
│                                                                     │
│  3. Encryption at Rest (AES-256-GCM)                                │
│     ┌──────────────────────────────────────────────────────────┐    │
│     │  Backup Stream: pg_dump → gzip → AES-256-GCM → S3       │    │
│     │  Master Key: Argon2id KDF → derived key per stream      │    │
│     │  Credentials: AES-256-GCM encrypted in SQLite           │    │
│     └──────────────────────────────────────────────────────────┘    │
│                                                                     │
│  4. Least Privilege                                                │
│     ┌──────────────────────────────────────────────────────────┐    │
│     │  DB users: only needed permissions (SELECT, LOCK, etc.)  │    │
│     │  S3 users: only PutObject/GetObject/ListBucket/Delete    │    │
│     └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Encryption at Rest

### Backup Data Encryption (AES-256-GCM)

Backup data is encrypted **client-side** before being uploaded to S3. The encryption happens in the streaming pipeline, so data never exists in plaintext outside the Go process.

**Algorithm:** AES-256-GCM (Galois/Counter Mode)

**Key Properties:**
- **Authenticated encryption:** GCM provides both confidentiality and integrity verification
- **Nonce reuse resistance:** Counter-based nonces ensure unique nonces per frame
- **Streaming support:** Chunked framing enables encrypting data of unknown size

#### Key Derivation

The master encryption key is provided via the `BACKUPEER_ENCRYPTION_KEY` environment variable. Before each backup stream, a **random salt** is generated, and Argon2id derives the actual encryption key:

```go
func (a *aesgcm) deriveKey(salt []byte) []byte {
    return argon2.IDKey(a.masterKey, salt, 1, 64*1024, 4, 32)
}
```

**Argon2id parameters:**

| Parameter | Value | Rationale |
|---|---|---|
| Time (iterations) | 1 | Balance security/speed for frequent operations |
| Memory | 64 MB | Moderate memory hardness |
| Parallelism | 4 | Matches common CPU core count |
| Key length | 32 bytes (256 bits) | AES-256 key size |
| Salt | 16 bytes random | Unique per stream |

This means:
- Each backup stream uses a **unique derived key** from the same master key
- Compromising one backup does not compromise others (different salt → different key)
- The master key never leaves the Backupeer process

#### Stream Encryption Format

```
┌──────────────────────────────────────────────────────────┐
│  Encrypted Stream Layout                                 │
│                                                          │
│  Bytes 0-15:    Salt (16 bytes, random per stream)       │
│  Bytes 16-27:   Frame 1 header (nonce 12B + len 4B)     │
│  Bytes 28-N:    Frame 1 ciphertext (variable)            │
│  ...            More frames...                           │
│  Final 16 bytes: EOF marker (all zeros)                  │
└──────────────────────────────────────────────────────────┘
```

Each frame is independently decryptable. See [Streaming Pipeline](./streaming-pipeline#encryption-framing-for-streaming) for full details.

### Credential Encryption at Rest

S3 access keys and secrets are encrypted in the SQLite database:

```go
type CredentialEncryptor struct {
    key []byte  // SHA-256 of master key phrase
}

func (e *CredentialEncryptor) Encrypt(plaintext []byte) ([]byte, error) {
    // AES-256-GCM with random nonce
    // Output: [nonce(12)][ciphertext+tag]
}
```

**Key management:**
- The credential encryption key is derived from `BACKUPEER_MASTER_KEY` (SHA-256)
- If no master key is set, a default fallback is used (`"backupeer-default-credential-key"`)
- **Recommendation:** Always set `BACKUPEER_MASTER_KEY` in production to a strong, unique secret
- Credentials are decrypted only when needed (before S3 operations)

### Checksum Verification

Backupeer computes a **SHA-256 checksum** of the compressed backup data (before encryption) during the streaming upload. This checksum is stored in the SQLite database alongside the backup record and can be verified on restore:

```go
hashWriter := sha256.New()
// During streaming: sha256 receives compressed data via io.MultiWriter
gw := gzip.NewWriter(io.MultiWriter(hashWriter, encWriter))
io.Copy(gw, dumpReader)
// Store checksum
b.Checksum = hex.EncodeToString(hashWriter.Sum(nil))
```

---

## Encryption in Transit

### API and Web UI (TLS)

In the standard Docker Compose deployment, Nginx terminates TLS for the Web UI and API:

```
Browser ──▶ Nginx (TLS) ──▶ Go Backend (HTTP)
              :443                :8080
```

**Configuration recommendations:**
- Use TLS 1.2 or higher
- Disable weak cipher suites
- Use Let's Encrypt or a trusted CA certificate
- Enable HSTS headers

### S3 Storage (HTTPS)

All S3-compatible storage communication uses HTTPS by default:

```go
client, err := minio.New(cfg.Endpoint, &minio.Options{
    Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
    Secure: true,  // HTTPS enforced
})
```

The `Secure: true` setting ensures TLS for all S3 API calls. This protects:
- Backup data in transit between Backupeer and S3
- Access key and secret key during authentication
- Integrity verification via TLS MAC

### Database Connections

Database connections are established using the native client tools (`pg_dump`, `mysqldump`, etc.) with password authentication over TCP.

**Recommendations:**
- For PostgreSQL: enable SSL connections with `sslmode=require`
- For MySQL: use `--ssl-mode=REQUIRED`
- Never use default passwords for database users

---

## Authentication and Authorization

### Session-Based Authentication

Backupeer uses a simple session-based auth system:

```go
type Service struct {
    adminUser string
    adminPass string  // SHA-256 hash
    secretKey string
    sessions  map[string]sessionInfo
}
```

**Login flow:**
1. User submits username/password via `POST /api/auth/login`
2. Backend verifies password against SHA-256 hash
3. On success, generates a random 32-byte session token
4. Token is stored in an in-memory map with a 24-hour expiry
5. An `HttpOnly` cookie is set on the response

**Session validation:**
- Token can be sent as a cookie (`session`) or `Authorization` header
- Validated on every API request (except login, health, and static files)
- Sessions expire after 24 hours of inactivity
- Logout invalidates the session token

### Password Storage

Passwords are stored as SHA-256 hashes:

```go
h := sha256.Sum256([]byte(adminPass))
hashedPass := hex.EncodeToString(h[:])
```

**Note:** While SHA-256 is used for simplicity in this single-admin tool, production deployments should consider using bcrypt/argon2 for password hashing. This is on the roadmap.

### Change Password

Password changes invalidate all existing sessions:

```go
func (s *Service) ChangePassword(currentPass, newPass string) error {
    // Verify current password
    // Hash new password
    // Clear all sessions → user must re-login
}
```

### API Protection

The auth middleware protects all API routes:

```go
func (s *Service) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Skip: /api/auth/login, /api/health, /
        // Validate session token from cookie or header
        // Return 401 if invalid
        next.ServeHTTP(w, r)
    })
}
```

---

## Secure Configuration File Handling

### Environment Variables

All sensitive configuration is passed via environment variables, never written to configuration files:

| Variable | Sensitivity | Description |
|---|---|---|
| `BACKUPEER_ADMIN_PASS` | High | Admin password |
| `BACKUPEER_SECRET_KEY` | High | Session signing secret |
| `BACKUPEER_ENCRYPTION_KEY` | Critical | Master key for backup encryption |
| `BACKUPEER_MASTER_KEY` | Critical | Master key for credential encryption |
| `BACKUPEER_S3_ACCESS_KEY` | High | S3 access key |
| `BACKUPEER_S3_SECRET_KEY` | Critical | S3 secret key |

### Docker Secrets

When using Docker Compose, pass sensitive values via environment files or Docker secrets:

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - BACKUPEER_ENCRYPTION_KEY=${BACKUPEER_ENCRYPTION_KEY}
      - BACKUPEER_MASTER_KEY=${BACKUPEER_MASTER_KEY}
    secrets:
      - admin_pass
      - s3_secret_key
```

### SQLite Database Protection

The SQLite database file (`/data/backupeer.db`) contains:
- Encrypted S3 credentials
- Backup metadata with storage paths
- Schedule configurations

**Protection recommendations:**
- Set file permissions to `0600` (owner read/write only)
- Run Backupeer in a Docker container with restricted filesystem access
- Consider filesystem-level encryption for the data directory
- Back up the SQLite database itself regularly

---

## Least Privilege Recommendations

### PostgreSQL User

```sql
-- Minimal permissions for pg_dump
CREATE USER backupeer WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE mydb TO backupeer;
GRANT USAGE ON SCHEMA public TO backupeer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backupeer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backupeer;

-- For pgBackRest (incremental), additional privileges needed:
GRANT EXECUTE ON FUNCTION pg_start_backup(text, boolean) TO backupeer;
GRANT EXECUTE ON FUNCTION pg_stop_backup() TO backupeer;
```

### MySQL/MariaDB User

```sql
-- Minimal permissions for mysqldump
CREATE USER 'backupeer'@'%' IDENTIFIED BY 'strong_password';
GRANT SELECT, LOCK TABLES, SHOW VIEW, TRIGGER ON mydb.* TO 'backupeer'@'%';
GRANT PROCESS, REPLICATION CLIENT ON *.* TO 'backupeer'@'%';

-- For XtraBackup/Mariabackup (incremental), additional privileges:
-- RELOAD is needed for FLUSH TABLES WITH READ LOCK
GRANT RELOAD ON *.* TO 'backupeer'@'%';
```

### S3 IAM Policy

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::your-backup-bucket",
                "arn:aws:s3:::your-backup-bucket/*"
            ]
        }
    ]
}
```

**Never use root credentials** for S3 access. Create a dedicated IAM user with only the permissions above.

---

## Audit Logging

Backupeer records all backup and restore operations with timestamps, status, and error details in the SQLite database. Each record includes:

| Field | Description |
|---|---|
| `id` | Unique backup/restore identifier |
| `connection_id` | Which database server |
| `database_id` | Which database |
| `backup_type` | Full or incremental |
| `status` | Running, success, or failed |
| `started_at` | Start timestamp |
| `completed_at` | Completion timestamp |
| `duration_ms` | Execution duration |
| `log_output` | Full operation log |
| `storage_path` | S3 key for the backup file |

This provides a complete, immutable audit trail of all backup operations.

---

## Security Roadmap

| Feature | Status | Priority |
|---|---|---|
| TLS for Web UI + API | ✅ Implemented (Nginx) | High |
| AES-256-GCM backup encryption | ✅ Implemented | High |
| Credential encryption at rest | ✅ Implemented | High |
| Session-based authentication | ✅ Implemented | High |
| HttpOnly cookies | ✅ Implemented | Medium |
| Argon2id key derivation | ✅ Implemented | High |
| Checksum verification | ✅ Implemented | Medium |
| bcrypt/argon2 password hashing | 🔜 Planned | Medium |
| Rate limiting | 🔜 Planned | Medium |
| IP allowlisting | 🔜 Planned | Low |
| Multi-user RBAC | 🔜 Planned (v2.0) | Low |
| API key authentication | 🔜 Planned | Low |
| Audit log export | 🔜 Planned | Low |

---

## Related

- [Streaming Pipeline](./streaming-pipeline) — Detailed encryption framing for streaming
- [Configuration Guide](../guide/configuration) — How to set encryption keys
- [Encryption Guide](../guide/encryption) — User-facing encryption configuration
