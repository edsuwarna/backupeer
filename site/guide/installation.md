---
title: 'Installation'
description: 'Detailed installation instructions for Jagad — Docker, binary download, building from source, and system requirements.'
---

# Installation

Jagad can be installed in several ways. Choose the method that best fits your environment.

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **CPU** | 1 core | 2+ cores |
| **Memory** | 64 MB (streaming pipeline) | 256 MB |
| **Disk** | 50 MB (binary only) | 1 GB (for config/logs) |
| **OS** | Linux, macOS | Linux (amd64 or arm64) |
| **Go version** | 1.25+ (for source build) | 1.25+ |

> **Memory note:** Jagad's streaming pipeline uses approximately 64KB of peak memory regardless of database size. System memory requirements are driven by the OS and dump tools, not Jagad.

### Required Dependencies

Jagad itself is a single binary, but the dump tools must be available on the system:

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

The easiest way to run Jagad in production.

```bash
# Pull the latest image
docker pull ghcr.io/edsuwarna/jagad:latest

# Run with a config file mounted
docker run -d \
  --name jagad \
  -v /path/to/jagad.yaml:/etc/jagad/config.yaml \
  -p 8080:8080 \
  ghcr.io/edsuwarna/jagad:latest \
  serve --config /etc/jagad/config.yaml
```

**Docker Compose:**

```yaml
# docker-compose.yml
version: "3.8"
services:
  jagad:
    image: ghcr.io/edsuwarna/jagad:latest
    container_name: jagad
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./jagad.yaml:/etc/jagad/config.yaml
      - jagad_data:/var/lib/jagad
    command: ["serve", "--config", "/etc/jagad/config.yaml"]

volumes:
  jagad_data:
```

If you need dump tools inside the container, use the `-full` variant:

```bash
docker pull ghcr.io/edsuwarna/jagad:latest-full
```

This image includes `pg_dump`, `mysqldump`, `mariadb-dump`, `pgbackrest`, `xtrabackup`, and `mariabackup`.

## Option 2: Binary Download

Pre-compiled binaries are available for Linux and macOS on the [releases page](https://github.com/edsuwarna/jagad/releases).

**Linux (amd64):**
```bash
curl -L -o jagad https://github.com/edsuwarna/jagad/releases/latest/download/jagad-linux-amd64
chmod +x jagad
sudo mv jagad /usr/local/bin/
```

**Linux (arm64):**
```bash
curl -L -o jagad https://github.com/edsuwarna/jagad/releases/latest/download/jagad-linux-arm64
chmod +x jagad
sudo mv jagad /usr/local/bin/
```

**macOS (arm64 / Apple Silicon):**
```bash
curl -L -o jagad https://github.com/edsuwarna/jagad/releases/latest/download/jagad-darwin-arm64
chmod +x jagad
sudo mv jagad /usr/local/bin/
```

**macOS (amd64 / Intel):**
```bash
curl -L -o jagad https://github.com/edsuwarna/jagad/releases/latest/download/jagad-darwin-amd64
chmod +x jagad
sudo mv jagad /usr/local/bin/
```

Verify:
```bash
jagad version
```

## Option 3: Build from Source

You'll need Go 1.25 or later installed.

```bash
# Clone the repository
git clone https://github.com/edsuwarna/jagad.git
cd jagad

# Build the binary
go build -o jagad ./cmd/jagad

# Optionally install to PATH
sudo mv jagad /usr/local/bin/
```

Build for a different platform:
```bash
GOOS=linux GOARCH=arm64 go build -o jagad-linux-arm64 ./cmd/jagad
```

## Option 4: Package Managers

### Homebrew (macOS/Linux)
```bash
brew install edsuwarna/tap/jagad
```

### Arch Linux (AUR)
```bash
yay -S jagad-bin
```

## Running as a Daemon

### systemd Service

Create a systemd service file at `/etc/systemd/system/jagad.service`:

```ini
[Unit]
Description=Jagad Database Backup Service
After=network.target

[Service]
Type=simple
User=jagad
Group=jagad
ExecStart=/usr/local/bin/jagad daemon --config /etc/jagad/config.yaml
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable jagad
sudo systemctl start jagad
sudo systemctl status jagad
```

### Docker as Daemon

```bash
docker run -d \
  --name jagad \
  --restart unless-stopped \
  -v /path/to/jagad.yaml:/etc/jagad/config.yaml \
  ghcr.io/edsuwarna/jagad:latest \
  daemon --config /etc/jagad/config.yaml
```

## Verifying the Installation

Run a quick connectivity test:

```bash
jagad check --config jagad.yaml
```

This will:
1. Test database connectivity
2. Verify storage provider access
3. Check for required dump tools
4. Display the configuration summary

## Next Steps

- Follow the [Quick Start](./getting-started.md) guide to run your first backup
- Learn how to configure Jagad in the [Configuration Guide](./configuration.md)
- Explore different [Storage Providers](./storage-providers.md)
