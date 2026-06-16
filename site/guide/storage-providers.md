---
title: 'Storage Providers'
description: 'Configure S3-compatible storage providers in Backupeer — AWS S3, Cloudflare R2, MinIO, Google Cloud Storage, Backblaze B2, and generic S3-compatible endpoints.'
---

# Storage Providers

Backupeer stores backups in **S3-compatible object storage**. Any provider that implements the S3 API can be used. This includes major cloud providers, self-hosted solutions, and specialty backup storage services.

## Provider Types

| Type Identifier | Provider | Default Endpoint | Path Style | Region Required |
|----------------|----------|-----------------|------------|----------------|
| `s3` | AWS S3 | `https://s3.<region>.amazonaws.com` | Virtual-hosted | ✅ |
| `r2` | Cloudflare R2 | `https://<account-id>.r2.cloudflarestorage.com` | Virtual-hosted | ❌ (use `auto`) |
| `minio` | MinIO | `http://localhost:9000` | ✅ Path-style | ❌ |
| `gcs` | Google Cloud Storage | `https://storage.googleapis.com` | Virtual-hosted | ✅ |
| `b2` | Backblaze B2 | `https://s3.us-west-004.backblazeb2.com` | Virtual-hosted | ✅ |
| `s3-compat` | Generic S3-compatible | Custom | Configurable | Varies |

## Common Configuration Fields

All providers share the same configuration structure:

```yaml
storage:
  - name: my-provider           # Unique identifier within config
    provider_type: s3           # One of the type identifiers above
    endpoint: https://...       # S3 API endpoint URL
    region: us-east-1           # Region (varies by provider)
    bucket: my-backups          # Bucket name (will be created if it doesn't exist)
    access_key: "<key>"         # Access key ID
    secret_key: "<secret>"      # Secret access key
    path_style: false           # Path-style vs virtual-hosted addressing
    is_default: false           # Use as default for schedules without explicit provider
```

## AWS S3

**Provider type:** `s3`

AWS S3 is the standard S3 implementation — all other providers emulate its API.

**Endpoint format:**
```
https://s3.<region>.amazonaws.com
```

**Examples by region:**

| Region | Endpoint |
|--------|----------|
| US East (N. Virginia) | `https://s3.us-east-1.amazonaws.com` |
| US East (Ohio) | `https://s3.us-east-2.amazonaws.com` |
| US West (Oregon) | `https://s3.us-west-2.amazonaws.com` |
| EU (Ireland) | `https://s3.eu-west-1.amazonaws.com` |
| EU (Frankfurt) | `https://s3.eu-central-1.amazonaws.com` |
| Asia Pacific (Singapore) | `https://s3.ap-southeast-1.amazonaws.com` |

**Configuration:**
```yaml
storage:
  - name: aws-production
    provider_type: s3
    endpoint: https://s3.us-east-1.amazonaws.com
    region: us-east-1
    bucket: my-company-backups
    access_key: "${AWS_ACCESS_KEY_ID}"
    secret_key: "${AWS_SECRET_ACCESS_KEY}"
    path_style: false
    is_default: true
```

> **💡 Tip:** For AWS S3, use an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, and `s3:DeleteObject` permissions on the backup bucket.

## Cloudflare R2

**Provider type:** `r2`

Cloudflare R2 is S3-compatible object storage with zero egress fees — ideal for backup storage.

**Endpoint format:**
```
https://<account-id>.r2.cloudflarestorage.com
```

You can find your account ID in the Cloudflare Dashboard under **Workers & Pages** → **Account ID**.

**Configuration:**
```yaml
storage:
  - name: cloudflare-r2
    provider_type: r2
    endpoint: https://abc123def456.r2.cloudflarestorage.com
    region: auto
    bucket: backupeer-backups
    access_key: "${R2_ACCESS_KEY_ID}"
    secret_key: "${R2_SECRET_ACCESS_KEY}"
    path_style: false
    is_default: false
```

> **💡 Tip:** R2 uses `auto` as the region. Generate your R2 API token from the **R2** → **Manage R2 API Tokens** page in the Cloudflare Dashboard.

## MinIO

**Provider type:** `minio`

MinIO is a high-performance, self-hosted S3-compatible object storage server.

**Endpoint format:**
```
http://<minio-host>:<port>
```

**Configuration:**
```yaml
storage:
  - name: self-hosted-minio
    provider_type: minio
    endpoint: http://minio.internal:9000
    region: us-east-1
    bucket: backupeer-backups
    access_key: "${MINIO_ROOT_USER}"
    secret_key: "${MINIO_ROOT_PASSWORD}"
    path_style: true          # MinIO requires path-style addressing
    is_default: true
```

> **⚠️ Important:** MinIO requires `path_style: true`. The `region` can be any value — MinIO doesn't validate it.

## Google Cloud Storage (GCS)

**Provider type:** `gcs`

Google Cloud Storage has an S3-compatible XML API endpoint.

**Endpoint format:**
```
https://storage.googleapis.com
```

**Configuration:**
```yaml
storage:
  - name: google-cloud-storage
    provider_type: gcs
    endpoint: https://storage.googleapis.com
    region: US-EAST1
    bucket: my-company-backups
    access_key: "${GCS_HMAC_ACCESS_KEY}"
    secret_key: "${GCS_HMAC_SECRET}"
    path_style: false
    is_default: false
```

> **💡 Tip:** GCS requires HMAC keys for S3-compatible access. Create them in the **Cloud Storage** → **Settings** → **Interoperability** tab. Use the GCS location (e.g., `US-EAST1`, `EUROPE-WEST2`) as the region.

## Backblaze B2

**Provider type:** `b2`

Backblaze B2 offers S3-compatible storage at lower prices than AWS S3.

**Endpoint format:**
```
https://s3.<region>.backblazeb2.com
```

**Common region endpoints:**

| Region | Endpoint |
|--------|----------|
| US West | `https://s3.us-west-004.backblazeb2.com` |
| US West (Phoenix) | `https://s3.us-west-001.backblazeb2.com` |
| EU Central | `https://s3.eu-central-003.backblazeb2.com` |

**Configuration:**
```yaml
storage:
  - name: backblaze-b2
    provider_type: b2
    endpoint: https://s3.us-west-004.backblazeb2.com
    region: us-west-004
    bucket: backupeer-backups
    access_key: "${B2_APPLICATION_KEY_ID}"
    secret_key: "${B2_APPLICATION_KEY}"
    path_style: false
    is_default: false
```

> **💡 Tip:** Generate an application key with **Read and Write** access to the specific bucket from the Backblaze B2 dashboard. The key ID is the access key, and the application key is the secret key.

## Generic S3-Compatible

**Provider type:** `s3-compat`

For any other S3-compatible provider (DigitalOcean Spaces, Scaleway, Vultr Object Storage, Wasabi, etc.).

**Configuration:**
```yaml
storage:
  - name: digitalocean-spaces
    provider_type: s3-compat
    endpoint: https://<region>.digitaloceanspaces.com
    region: sfo3
    bucket: my-backups
    access_key: "${DO_SPACES_KEY}"
    secret_key: "${DO_SPACES_SECRET}"
    path_style: false
    is_default: false
```

**Common providers and their endpoints:**

| Provider | Endpoint Format | Path Style | Region |
|----------|----------------|------------|--------|
| DigitalOcean Spaces | `https://<region>.digitaloceanspaces.com` | Virtual-hosted | e.g. `sfo3`, `nyc3` |
| Scaleway Object Storage | `https://s3.<region>.scw.cloud` | Virtual-hosted | e.g. `fr-par`, `nl-ams` |
| Wasabi | `https://s3.<region>.wasabisys.com` | Virtual-hosted | e.g. `us-east-1`, `eu-central-1` |
| Vultr Object Storage | `https://<region>.vultrobjects.com` | Virtual-hosted | e.g. `ewr1`, `fra1` |
| Oracle Cloud Object Storage | `https://<namespace>.compat.objectstorage.<region>.oraclecloud.com` | Path-style | e.g. `us-ashburn-1` |
| Linode Object Storage | `https://<cluster>.linodeobjects.com` | Virtual-hosted | e.g. `us-east-1` |
| Alibaba Cloud OSS | `https://oss-<region>.aliyuncs.com` | Virtual-hosted | e.g. `cn-hangzhou` |

## Provider Comparison

| Feature | AWS S3 | R2 | MinIO | GCS | B2 |
|---------|--------|----|-------|-----|----|
| Egress fees | ✅ Yes | ❌ Free | ❌ Free | ✅ Yes | ✅ Free up to 3x storage |
| Storage cost | ~$0.023/GB | ~$0.015/GB | Free (self-hosted) | ~$0.020/GB | ~$0.006/GB |
| Global regions | 30+ | 50+ | Self-hosted | 30+ | 4 |
| S3 API compatibility | Native | Native | Native | XML API | Limited |
| Free tier | 12 months (5GB) | 10GB | Self-hosted | 90 days ($300) | 10GB |
| Best for | General purpose | Multi-cloud | Self-hosted/air-gapped | GCP ecosystem | Low-cost backup |

## Multiple Providers

You can configure multiple storage providers and assign different schedules to different providers:

```yaml
storage:
  - name: aws-hot-backups
    provider_type: s3
    endpoint: https://s3.us-east-1.amazonaws.com
    region: us-east-1
    bucket: hot-backups
    access_key: "${AWS_KEY}"
    secret_key: "${AWS_SECRET}"
    is_default: true

  - name: b2-cold-storage
    provider_type: b2
    endpoint: https://s3.us-west-004.backblazeb2.com
    region: us-west-004
    bucket: cold-backups
    access_key: "${B2_KEY_ID}"
    secret_key: "${B2_APP_KEY}"
    is_default: false

schedules:
  - name: daily-hot
    connection: production-postgres
    database: myapp
    backup_type: full
    cron_expr: "0 2 * * *"
    storage: aws-hot-backups      # Uses AWS S3
    retention_full: 7
    enabled: true

  - name: weekly-cold
    connection: production-postgres
    database: myapp
    backup_type: full
    cron_expr: "0 3 * * 0"
    storage: b2-cold-storage       # Uses Backblaze B2
    retention_full: 52
    enabled: true
```

## Default Provider

The provider marked `is_default: true` is used for schedules that don't specify a `storage` field. If no default is set, Backupeer will return an error when a schedule lacks a provider reference.

## Path-Style vs Virtual-Hosted Addressing

S3-compatible APIs support two addressing modes:

- **Virtual-hosted** (`path_style: false`): `https://bucket.endpoint/key`
- **Path-style** (`path_style: true`): `https://endpoint/bucket/key`

Use `path_style: true` for:
- MinIO (always required)
- On-premises S3 gateways
- Most self-hosted S3 implementations

Use `path_style: false` (default) for:
- AWS S3
- Cloudflare R2
- Google Cloud Storage
- Backblaze B2
- DigitalOcean Spaces
- Most cloud S3-compatible services
