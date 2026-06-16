---
title: 'Contributing'
---

# Contributing

Thank you for your interest in contributing to Backupeer! This document provides guidelines for setting up your development environment, building from source, running tests, and submitting changes.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/edsuwarna/backupeer.git
cd backupeer

# Install dependencies
make deps

# Run the application in development mode
make run-quick
```

The application will start at `http://localhost:8080` with SQLite storage at `./data/backupeer.db`.

---

## Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Go | 1.25+ | Backend runtime |
| Git | 2.x | Version control |
| Docker + Compose | Latest | Containerized development and testing |
| PostgreSQL client | 15+ | Testing PostgreSQL backups |
| MySQL client | 8.0+ | Testing MySQL backups |
| MariaDB client | 10.2+ | Testing MariaDB backups |

Optional but recommended:

| Tool | Purpose |
|---|---|
| `pgbackrest` | Testing incremental backup engine |
| `xtrabackup` | Testing MySQL incremental backups |
| `mariabackup` | Testing MariaDB incremental backups |
| `golangci-lint` | Code quality and style checking |
| `pre-commit` | Automated pre-commit hooks |

### Go Version Management

Backupeer uses Go 1.25+. You can check your Go version:

```bash
go version
```

If you need a different version, use `go install` or a version manager like `g` or `goenv`.

### Docker Development

For a full environment with database servers for testing:

```bash
# Start PostgreSQL, MySQL, and MinIO for development
docker compose -f docker-compose.dev.yml up -d

# This gives you:
# - PostgreSQL on :5432
# - MySQL on :3306
# - MinIO (S3-compatible) on :9000
# - Backupeer on :8080
```

---

## Project Structure

```
backupeer/
├── cmd/backupeer/           # Main entrypoint
│   └── main.go              # Application bootstrap, dependency injection
├── internal/
│   ├── api/                 # HTTP router, middleware, response helpers
│   │   ├── router.go        # Route registration
│   │   └── response.go      # JSON response helpers
│   ├── auth/                # Authentication and session management
│   │   └── service.go       # Login, logout, session validation, middleware
│   ├── backup/              # Backup execution engine
│   │   ├── service.go       # Full backup streaming pipeline
│   │   ├── handler.go       # HTTP handlers for backup operations
│   │   ├── model.go         # Backup domain model
│   │   ├── incremental.go   # IncrementalEngine interface + registry
│   │   ├── pgbackrest.go    # PostgreSQL incremental via pgBackRest
│   │   ├── xtrabackup.go    # MySQL incremental via XtraBackup
│   │   └── mariabackup.go   # MariaDB incremental via Mariabackup
│   ├── config/              # Environment variable configuration
│   │   └── config.go        # Config struct + Load() from env
│   ├── connection/          # Database connection management
│   │   ├── service.go       # CRUD + test connection + auto-discover
│   │   ├── handler.go       # HTTP handlers
│   │   └── model.go         # Connection and Database domain models
│   ├── encryption/          # AES-256-GCM encryption service
│   │   └── service.go       # EncryptStream, DecryptStream, key derivation
│   ├── httputil/            # Shared HTTP utilities
│   │   └── response.go      # JSON encoding, error responses
│   ├── notification/        # Multi-channel notification service
│   │   ├── service.go       # Telegram, Discord, Slack senders
│   │   ├── handler.go       # HTTP handlers
│   │   └── model.go         # Notification target domain model
│   ├── repository/          # SQLite data access layer
│   │   ├── db.go            # Database connection and schema migration
│   │   ├── backup.go        # Backup CRUD
│   │   ├── connection.go    # Connection CRUD
│   │   ├── schedule.go      # Schedule CRUD
│   │   ├── storage_provider.go   # Storage provider CRUD
│   │   ├── restore.go       # Restore CRUD
│   │   └── notification.go  # Notification target CRUD
│   ├── restore/             # Restore engine
│   │   ├── service.go       # Download → decrypt → decompress → restore
│   │   └── model.go         # Restore domain model
│   ├── schedule/            # Cron scheduler
│   │   ├── scheduler.go     # robfig/cron wrapper, job management
│   │   ├── service.go       # Schedule CRUD
│   │   ├── handler.go       # HTTP handlers
│   │   └── model.go         # Schedule domain model
│   ├── settings/            # Application settings
│   │   └── service.go       # Theme preferences, etc.
│   └── storage/             # S3-compatible storage abstraction
│       ├── provider.go      # Provider domain model + repository interface
│       ├── provider_service.go  # Provider CRUD with credential encryption
│       ├── provider_handler.go  # HTTP handlers
│       ├── s3.go            # S3Client (UploadStream, Download, List, Delete)
│       ├── service.go       # Storage service interface
│       └── crypto.go        # CredentialEncryptor for S3 keys at rest
├── web/                     # Frontend (Vanilla JS SPA)
│   ├── index.html           # Single HTML page
│   ├── css/
│   │   └── style.css        # All styles with CSS custom properties
│   └── js/
│       └── app.js           # SPA client with routing and API calls
├── site/                    # Documentation site (VitePress)
│   ├── index.md             # Landing page
│   ├── .vitepress/
│   │   ├── config.ts        # Site configuration
│   │   └── theme/           # Custom theme
│   ├── guide/               # User guides
│   └── architecture/        # Architecture docs
├── prd/                     # Product requirements documents
├── sketches/                # UI mockups and wireframes
├── Dockerfile               # Backend Docker image
├── Dockerfile.frontend      # Frontend Nginx image
├── docker-compose.yml       # Production Docker compose
├── Makefile                 # Build, test, run targets
└── go.mod                   # Go module definition
```

---

## Building from Source

### Development Build

```bash
# Quick build
make build
# Binary at: dist/backupeer

# Run directly (hot-reload via 'go run')
make run-quick
```

### Production Build

```bash
# Build for current platform
make build

# Cross-compile for multiple platforms
make dist
# Outputs:
#   dist/backupeer-linux-amd64
#   dist/backupeer-linux-arm64
```

### Docker Build

```bash
# Build and run with Docker Compose
make docker-run

# Build images only
make docker-build
```

### Build Tags

The build supports the following ldflags:

```bash
go build -ldflags="-s -w -X main.Version=$(git describe --tags --always --dirty)"
```

- `-s -w`: Strip debug information (smaller binary)
- `-X main.Version`: Embed version string

---

## Running Tests

### All Tests

```bash
make test
```

This runs all tests with the race detector and code coverage:

```bash
go test -race -cover ./...
```

### Test by Package

```bash
# Test a specific package
go test -race -cover ./internal/backup/...

# Test with verbose output
go test -v -race -cover ./internal/encryption/...

# Test a single function
go test -v -run TestEncryptStream ./internal/encryption/
```

### Integration Tests

Integration tests require database servers and S3-compatible storage:

```bash
# Start test infrastructure
docker compose -f docker-compose.dev.yml up -d

# Run integration tests
go test -tags=integration -v ./internal/backup/...
```

### Test Guidelines

- **Unit tests** should not require external services (mock interfaces)
- **Integration tests** use the `integration` build tag
- Aim for **>70% code coverage** for backend packages
- Test error paths, not just happy paths
- Use `t.Parallel()` where safe to speed up test suites

### Writing Tests

```go
func TestStreamingPipeline(t *testing.T) {
    t.Parallel()

    // Create a mock dump source
    dumpData := []byte("CREATE TABLE test (id INT);")

    // Create a pipe for S3
    pr, pw := io.Pipe()

    // Simulate the streaming pipeline
    go func() {
        gw := gzip.NewWriter(pw)
        gw.Write(dumpData)
        gw.Close()
        pw.Close()
    }()

    // Read the compressed output
    compressed, err := io.ReadAll(pr)
    assert.NoError(t, err)
    assert.True(t, len(compressed) > 0)

    // Verify decompression
    gr, _ := gzip.NewReader(bytes.NewReader(compressed))
    decompressed, _ := io.ReadAll(gr)
    assert.Equal(t, dumpData, decompressed)
}
```

---

## Code Style

### Go Code

Backupeer follows standard Go conventions with some specific guidelines:

1. **Formatting:** Use `gofmt` (or `go fmt`) exclusively. No exceptions.
2. **Linting:** Run `golangci-lint` before submitting. Configuration is in `.golangci.yml`.
3. **Naming:**
   - Use short but descriptive variable names (`conn` not `connection`, `db` not `database`)
   - Avoid stutter (`backup.Service` not `backup.BackupService`)
   - Use `CamelCase` for exported, `camelCase` for unexported
4. **Comments:**
   - Every exported type, function, and constant must have a doc comment
   - Comments should explain *why*, not *what* (the code says what)
5. **Error handling:**
   - Always check errors
   - Wrap errors with context: `fmt.Errorf("s3 upload: %w", err)`
   - Use `%w` for error wrapping (Go 1.13+)
6. **Imports:**
   - Group: standard library → third-party → internal packages
   - Use `gofumpt` style import ordering

### Go File Template

```go
// Package backup handles database backup execution.
package backup

import (
    "context"
    "fmt"
    "io"
    "os/exec"
)

// Service handles backup execution and management.
type Service struct {
    repo Repository
}

// NewService creates a new backup service.
func NewService(repo Repository) *Service {
    return &Service{repo: repo}
}

// StartBackup initiates a backup for the given database.
func (s *Service) StartBackup(dbName string) error {
    // ...
}
```

### Frontend Code (JavaScript)

1. **Formatting:** Use standard JavaScript conventions (2-space indentation)
2. **Naming:** `camelCase` for variables and functions, `PascalCase` for classes
3. **No transpilation:** The frontend is vanilla JS — no build step
4. **API calls:** Use `fetch()` with async/await pattern
5. **DOM manipulation:** Direct DOM manipulation (no framework)

### CSS

1. **Custom properties:** Use CSS custom properties for theming (dark/light mode)
2. **Class naming:** Semantic class names with BEM-like conventions
3. **Responsive:** Mobile-first approach with media queries at 768px breakpoint

---

## Pull Request Workflow

### 1. Fork and Clone

```bash
git clone https://github.com/your-username/backupeer.git
cd backupeer
git remote add upstream https://github.com/edsuwarna/backupeer.git
```

### 2. Create a Branch

```bash
git checkout -b feat/your-feature-name
```

**Branch naming convention:**

| Prefix | Use Case |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation |
| `refactor/` | Code refactoring |
| `test/` | Adding or updating tests |
| `chore/` | Maintenance, dependencies |

### 3. Make Changes

- Write code following the [Code Style](#code-style) guidelines
- Add tests for new functionality
- Update or add documentation for user-facing changes
- Keep commits atomic and well-described

**Commit message format:**

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Examples:
```
feat(backup): add streaming encryption pipeline
fix(scheduler): handle daylight saving time transitions
docs(security): add encryption key management guide
```

### 4. Run Tests

```bash
# Run all tests
make test

# Run linter
golangci-lint run ./...

# Run vet
make vet
```

### 5. Push and Create PR

```bash
git push origin feat/your-feature-name
```

Then create a Pull Request on GitHub with:

- **Clear title** describing the change
- **Description** explaining what and why
- **Related issues** referenced (e.g., "Closes #123")
- **Checklist:**
  - [ ] Tests added/updated
  - [ ] Documentation updated
  - [ ] Code formatted with `go fmt`
  - [ ] All tests pass
  - [ ] Lint checks pass

### 6. Review Process

1. At least one maintainer must review the PR
2. Address all review comments
3. Keep the PR focused — one feature/fix per PR
4. Squash commits before merge if needed

### 7. After Merge

- Delete your feature branch
- Celebrate your contribution 🎉

---

## Development Guidelines

### Adding a New Database Type

1. Add dump command in `internal/backup/service.go` `buildDumpCmd()`
2. Add restore logic in `internal/restore/service.go` `executeRestore()`
3. Add incremental engine implementing `IncrementalEngine` interface
4. Register the engine in `cmd/backupeer/main.go`
5. Add connection form fields in `web/index.html`
6. Add validation in `internal/connection/service.go`
7. Update documentation

### Adding a New Storage Provider

1. Add provider constant in `internal/storage/provider.go`
2. Add provider configuration form in `web/index.html`
3. The existing `S3Client` works for any S3-compatible service

### Adding a New Notification Channel

1. Add notification type constant in `internal/notification/model.go`
2. Add sender method in `internal/notification/service.go`
3. Add configuration form in `web/index.html`
4. Add repository methods if new config fields are needed

### Working with SQLite Migrations

Database migrations are handled automatically at startup in `internal/repository/db.go`. To add a new table or column:

1. Add the schema version constant
2. Add the migration SQL to the migration function
3. Migrations are idempotent (safe to run multiple times)

---

## Documentation

Documentation is built with [VitePress](https://vitepress.dev/).

```bash
# Install documentation dependencies
cd site
npm install

# Development server (hot reload)
npm run dev

# Build for production
npm run build
```

**Documentation conventions:**
- Markdown files in `site/` directory
- Frontmatter with `title` for page titles
- Relative links between pages (e.g., `../guide/getting-started`)
- Code blocks with language annotations
- ASCII diagrams for architecture concepts

---

## Community

- **GitHub Issues:** Bug reports and feature requests
- **Pull Requests:** Code contributions
- **Discussions:** Questions and ideas

**Code of Conduct:** Be respectful, inclusive, and constructive. All participants in this project are expected to follow the [Contributor Covenant](https://www.contributor-covenant.org/).

---

## License

By contributing to Backupeer, you agree that your contributions will be licensed under the [Apache License 2.0](https://github.com/edsuwarna/backupeer/blob/main/LICENSE).
