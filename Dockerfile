# syntax=docker/dockerfile:1
FROM golang:1.25-bookworm AS builder
RUN apt-get update && apt-get install -y --no-install-recommends gcc libsqlite3-dev
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -ldflags="-s -w -X main.Version=$(cat VERSION 2>/dev/null || echo dev)" -o /app/jagad ./cmd/jagad

# Base runtime: Debian + all DB tools (except Percona)
FROM debian:bookworm-slim AS runtime-base
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libsqlite3-0 \
    tzdata \
    wget \
    postgresql-client \
    default-mysql-client \
    mariadb-backup \
    pgbackrest \
    && rm -rf /var/lib/apt/lists/*

# Final runtime: add Percona XtraBackup
FROM runtime-base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl lsb-release \
    && wget -qO /tmp/percona.deb https://repo.percona.com/apt/percona-release_latest.bookworm_all.deb \
    && (dpkg -i /tmp/percona.deb || true) \
    && apt-get install -f -y \
    && percona-release enable-only tools \
    && apt-get update \
    && apt-get install -y --no-install-recommends percona-xtrabackup-80 \
    && rm -rf /var/lib/apt/lists/* /tmp/percona.deb

WORKDIR /app
COPY --from=builder /app/jagad .
VOLUME ["/data"]
EXPOSE 8080
ENV JAGAD_PORT=8080
ENV JAGAD_DATA_DIR=/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:8080/api/health || exit 1
ENTRYPOINT ["/app/jagad"]
