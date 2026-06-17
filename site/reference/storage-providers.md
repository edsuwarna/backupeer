---
title: 'Storage Provider Reference'
description: 'All storage providers in table format with connection strings, required fields, and optional fields'
---

# Storage Provider Reference

Jagad supports any **S3-compatible object storage** service. Storage providers are managed through the Web UI or API and support credential encryption at rest.

## Provider Types

| Provider Type | Identifier | Common Use |
|---------------|------------|------------|
| AWS S3 | `s3` | Amazon Web Services S3 |
| Cloudflare R2 | `r2` | Cloudflare R2 Object Storage |
| MinIO | `minio` | Self-hosted MinIO server |
| Google Cloud Storage | `gcs` | Google Cloud Storage (S3-compatible) |
| Backblaze B2 | `b2` | Backblaze B2 Cloud Storage |
| S3-Compatible | `s3-compat` | Any other S3-compatible service |

## Provider Fields

### Common Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | **Yes** | — | Human-readable name (e.g., "Production S3") |
| `provider_type` | string | **Yes** | `s3` | Provider type identifier (see table above) |
| `endpoint` | string | **Yes** | — | S3-compatible endpoint URL |
| `region` | string | No | `auto` | Storage region |
| `bucket` | string | **Yes** | — | Bucket/container name |
| `access_key` | string | **Yes** | — | Access key ID |
| `secret_key` | string | **Yes** | — | Secret access key |
| `path_style` | bool | No | `true` | Use path-style addressing (vs virtual-hosted) |
| `is_default` | bool | No | `false` | Set as the default provider |

### Provider-Specific Details

## AWS S3 (`s3`)

```yaml
name: AWS S3 Production
provider_type: s3
endpoint: https://s3.us-east-1.amazonaws.com
region: us-east-1
bucket: my-company-backups
access_key: AKIAIOSFODNN7EXAMPLE
secret_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
path_style: false
is_default: true
```

| Field | Recommendation |
|-------|---------------|
| `endpoint` | `https://s3.<region>.amazonaws.com` (automatic with AWS SDK) |
| `region` | The AWS region your bucket is in (e.g., `us-east-1`, `eu-west-2`) |
| `path_style` | `false` (AWS S3 uses virtual-hosted style by default) |
| Permissions | Requires `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`, `s3:GetBucketLocation` |

## Cloudflare R2 (`r2`)

```yaml
name: Cloudflare R2
provider_type: r2
endpoint: https://<account-id>.r2.cloudflarestorage.com
region: auto
bucket: my-backups
access_key: <r2-access-key-id>
secret_key: <r2-secret-access-key>
path_style: true
is_default: false
```

| Field | Recommendation |
|-------|---------------|
| `endpoint` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (get from R2 dashboard) |
| `region` | `auto` (R2 is globally distributed) |
| `path_style` | `true` (R2 requires path-style) |
| Credentials | Generate from R2 dashboard → Manage R2 API Tokens |

## MinIO (`minio`)

```yaml
name: Self-Hosted MinIO
provider_type: minio
endpoint: https://minio.example.com:9000
region: us-east-1
bucket: backups
access_key: minioadmin
secret_key: minioadmin
path_style: true
is_default: true
```

| Field | Recommendation |
|-------|---------------|
| `endpoint` | Your MinIO server URL with port (default `:9000`) |
| `region` | MinIO default is `us-east-1` (can be any string) |
| `path_style` | `true` (MinIO requires path-style) |

## Google Cloud Storage (`gcs`)

```yaml
name: GCS Backups
provider_type: gcs
endpoint: https://storage.googleapis.com
region: auto
bucket: my-gcs-bucket
access_key: <hmac-access-id>
secret_key: <hmac-secret>
path_style: false
is_default: false
```

| Field | Recommendation |
|-------|---------------|
| `endpoint` | `https://storage.googleapis.com` |
| `region` | `auto` (GCS handles routing automatically) |
| `path_style` | `false` |
| Credentials | Use **HMAC keys** (not service account keys). Generate from GCS → Settings → Interoperability |

## Backblaze B2 (`b2`)

```yaml
name: Backblaze B2
provider_type: b2
endpoint: https://s3.us-west-002.backblazeb2.com
region: us-west-002
bucket: my-backups
access_key: <b2-application-key-id>
secret_key: <b2-application-key>
path_style: true
is_default: false
```

| Field | Recommendation |
|-------|---------------|
| `endpoint` | `https://s3.<region>.backblazeb2.com` (see B2 dashboard for your region) |
| `region` | Your B2 region ID (e.g., `us-west-002`, `eu-central-003`) |
| `path_style` | `true` (B2 requires path-style) |
| Credentials | Use **Application Key** (not master key) from B2 dashboard |

## S3-Compatible (`s3-compat`)

For any other S3-compatible service (DigitalOcean Spaces, IBM Cloud Object Storage, Oracle Cloud, Scaleway, etc.):

```yaml
name: DigitalOcean Spaces
provider_type: s3-compat
endpoint: https://nyc3.digitaloceanspaces.com
region: nyc3
bucket: my-backups
access_key: <spaces-key>
secret_key: <spaces-secret>
path_style: false
is_default: false
```

## Connection String Reference

Jagad does not use traditional connection strings for storage providers. Instead, providers are configured via the Web UI or API with the individual fields listed above.

For reference, the equivalent S3-style connection string for each service:

| Provider | Connection String Pattern |
|----------|--------------------------|
| AWS S3 | `s3://AKIA...:wJalrX...@s3.amazonaws.com/bucket?region=us-east-1` |
| Cloudflare R2 | `s3://key:secret@ACCOUNT.r2.cloudflarestorage.com/bucket?region=auto` |
| MinIO | `s3://user:pass@minio.example.com:9000/bucket?region=us-east-1&path-style=true` |
| GCS | `s3://HMAC_ID:HMAC_SECRET@storage.googleapis.com/bucket` |
| B2 | `s3://KEY_ID:APP_KEY@s3.REGION.backblazeb2.com/bucket?path-style=true` |

## Storage Path Convention

Jagad stores backup files with the following path structure:

### Full Backups (pg_dump/mysqldump)

```
backups/{connection_name}/{database_name}/{backup_id}-{timestamp}.sql.gz
```

Example: `backups/Production PG/mydb/bck_abc123-20250101-020000.sql.gz`

If encryption is enabled, the file is stored as encrypted data but the path remains the same (the encryption is transparent at the storage level).

### Incremental Backups

**pgBackRest:**
```
pgbackrest/{connection_name}/{stanza}/
```

**XtraBackup:**
```
xtrabackup/{connection_name}/{backup_dir}/{backup_id}/{backup_id}.tar.gz
```

**Mariabackup:**
```
mariabackup/{connection_name}/{backup_dir}/{backup_id}/{backup_id}.tar.gz
```

## Credential Security

- **At rest**: Access keys and secret keys are encrypted using AES-256-GCM with a key derived from the `JAGAD_MASTER_KEY`.
- **In API responses**: Secret keys are masked with `••••••` for security.
- **Internal usage**: The `GetDecrypted()` method returns raw credentials for backup/restore operations.

## Managing Providers

### Via API

```bash
# List all providers
curl -H "Authorization: <token>" http://localhost:8080/api/storage-providers

# Create a new provider
curl -X POST http://localhost:8080/api/storage-providers \
  -H "Content-Type: application/json" \
  -H "Authorization: <token>" \
  -d '{
    "name": "AWS S3",
    "provider_type": "s3",
    "endpoint": "https://s3.us-east-1.amazonaws.com",
    "region": "us-east-1",
    "bucket": "my-backups",
    "access_key": "AKIA...",
    "secret_key": "...",
    "is_default": true
  }'

# Test a provider connection
curl -X POST http://localhost:8080/api/storage-providers/{id}/test \
  -H "Authorization: <token>"
```

### Via Web UI

1. Navigate to **Settings > Storage Providers**
2. Click **Add Provider**
3. Fill in the provider details
4. Click **Test Connection** to verify
5. Click **Save**
