---
title: 'Installation'
description: 'Detailed installation instructions for Backupeer — Docker, binary download, building from source, and system requirements.'
---

# Installation

Backupeer can be installed in several ways. Choose the method that best fits your environment.

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **CPU** | 1 core | 2+ cores |
| **Memory** | 64 MB (streaming pipeline) | 256 MB |
| **Disk** | 50 MB (binary only) | 1 GB (for config/logs) |
| **OS** | Linux, macOS | Linux (amd64 or arm64) |
| **Go version** | 1.25+ (for source build) | 1.25+ |

> **Memory note:** Backupeer's streaming pipeline uses approximately 64KB of peak memory regardless of database size. System memory requirements are driven by the OS and dump tools, not Backupeer.

### Required Dependencies

Backupeer itself is a single binary, but the dump tools must be available on the system:

| Database | Required Tool | Installation |
|----------|--------------|-------------|
| PostgreSQL | `pg_dump` | `apt install postgresql-client` / `brew install postgresql` |
| MySQL | `mysqldump` | `apt install mysql-client` / `brew install mysql-client` |
| MariaDB | `mariadb-dump` or `mysqldump` | `apt install mariadb-client` / `brew install mariadb` |

### Optional Dependencies (Incremental Backups)

| Database | Required Tool | Purpose |
|----------|--------------|---------|
| PostgreSQL | `pgbackrest` | WAL-based incremental backups |
| MySQL | `xtrabackup` (Percona XtraBackup) | Page-level incremental backups |
| MariaDB | `mariabackup` | Page-level incremental backups |

## Option 1: Docker (Recommended)

The easiest way to run Backupeer in production.

```bash
# Pull the latest image
docker pull ghcr.io/edsuwarna/backupeer:latest

# Run with a config file mounted
docker run -d \
  --name backupeer \
  -v /path/to/backupeer.yaml:/etc/backupeer/config.yaml \
  -p 8080:8080 \
  ghcr.io/edsuwarna/backupeer:latest \
  serve --config /etc/backupeer/config.yaml
```

**Docker Compose:**

```yaml
# docker-compose.yml
version: "3.8"
services:
  backupeer:
    image: ghcr.io/edsuwarna/backupeer:latest
    container_name: backupeer
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./backupeer.yaml:/etc/backupeer/config.yaml
      - backupeer_data:/var/lib/backupeer
    command: ["serve", "--config", "/etc/backupeer/config.yaml"]

volumes:
  backupeer_data:
```

If you need dump tools inside the container, use the `-full` variant:

```bash
docker pull ghcr.io/edsuwarna/backupeer:latest-full
```

This image includes `pg_dump`, `mysqldump`, `mariadb-dump`, `pgbackrest`, `xtrabackup`, and `mariabackup`.

## Option 2: Binary Download

Pre-compiled binaries are available for Linux and macOS on the [releases page](https://github.com/edsuwarna/backupeer/releases).

**Linux (amd64):**
```bash
curl -L -o backupeer https://github.com/edsuwarna/backupeer/releases/latest/download/backupeer-linux-amd64
chmod +x backupeer
sudo mv backupeer /usr/local/bin/
```

**Linux (arm64):**
```bash
curl -L -o backupeer https://github.com/edsuwarna/backupeer/releases/latest/download/backupeer-linux-arm64
chmod +x backupeer
sudo mv backupeer /usr/local/bin/
```

**macOS (arm64 / Apple Silicon):**
```bash
curl -L -o backupeer https://github.com/edsuwarna/backupeer/releases/latest/download/backupeer-darwin-arm64
chmod +x backupeer
sudo mv backupeer /usr/local/bin/
```

**macOS (amd64 / Intel):**
```bash
curl -L -o backupeer https://github.com/edsuwarna/backupeer/releases/latest/download/backupeer-darwin-amd64
chmod +x backupeer
sudo mv backupeer /usr/local/bin/
```

Verify:
```bash
backupeer version
```

## Option 3: Build from Source

You'll need Go 1.25 or later installed.

```bash
# Clone the repository
git clone https://github.com/edsuwarna/backupeer.git
cd backupeer

# Build the binary
go build -o backupeer ./cmd/backupeer

# Optionally install to PATH
sudo mv backupeer /usr/local/bin/
```

Build for a different platform:
```bash
GOOS=linux GOARCH=arm64 go build -o backupeer-linux-arm64 ./cmd/backupeer
```

## Option 4: Package Managers

### Homebrew (macOS/Linux)
```bash
brew install edsuwarna/tap/backupeer
```

### Arch Linux (AUR)
```bash
yay -S backupeer-bin
```

## Running as a Daemon

### systemd Service

Create a systemd service file at `/etc/systemd/system/backupeer.service`:

```ini
[Unit]
Description=Backupeer Database Backup Service
After=network.target

[Service]
Type=simple
User=backupeer
Group=backupeer
ExecStart=/usr/local/bin/backupeer daemon --config /etc/backupeer/config.yaml
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable backupeer
sudo systemctl start backupeer
sudo systemctl status backupeer
```

### Docker as Daemon

```bash
docker run -d \
  --name backupeer \
  --restart unless-stopped \
  -v /path/to/backupeer.yaml:/etc/backupeer/config.yaml \
  ghcr.io/edsuwarna/backupeer:latest \
  daemon --config /etc/backupeer/config.yaml
```

## Verifying the Installation

Run a quick connectivity test:

```bash
backupeer check --config backupeer.yaml
```

This will:
1. Test database connectivity
2. Verify storage provider access
3. Check for required dump tools
4. Display the configuration summary

## Next Steps

- Follow the [Quick Start](./getting-started.md) guide to run your first backup
- Learn how to configure Backupeer in the [Configuration Guide](./configuration.md)
- Explore different [Storage Providers](./storage-providers.md)
