# syntax=docker/dockerfile:1
FROM golang:1.25-alpine AS builder
RUN apk add --no-cache gcc musl-dev sqlite-dev
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -ldflags="-s -w -X main.Version=$(cat VERSION 2>/dev/null || echo dev)" -o /app/backupeer ./cmd/backupeer

FROM alpine:3.19
RUN apk add --no-cache ca-certificates sqlite-libs tzdata postgresql-client mysql-client mariadb-client
WORKDIR /app
COPY --from=builder /app/backupeer .
VOLUME ["/data"]
EXPOSE 8080
ENV BACKUPEER_PORT=8080
ENV BACKUPEER_DATA_DIR=/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:8080/api/health || exit 1
ENTRYPOINT ["/app/backupeer"]
