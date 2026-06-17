.PHONY: build run clean deps docker-build docker-run

BINARY=jagad
BUILD_DIR=dist
VERSION=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

all: build

deps:
	go mod tidy

build: deps
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=1 go build -ldflags="-s -w -X main.Version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY) ./cmd/jagad

run: build
	JAGAD_DATA_DIR=./data ./$(BUILD_DIR)/$(BINARY)

run-quick:
	go run ./cmd/jagad

docker-build:
	docker compose build

docker-run:
	docker compose up -d

docker-stop:
	docker compose down

docker-logs:
	docker compose logs -f

test:
	go test -race -cover ./...

vet:
	go vet ./...

clean:
	rm -rf $(BUILD_DIR) data/

dist: build
	@echo "Building for multiple platforms..."
	GOOS=linux GOARCH=amd64 CGO_ENABLED=1 go build -ldflags="-s -w -X main.Version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY)-linux-amd64 ./cmd/jagad
	GOOS=linux GOARCH=arm64 CGO_ENABLED=1 go build -ldflags="-s -w -X main.Version=$(VERSION)" -o $(BUILD_DIR)/$(BINARY)-linux-arm64 ./cmd/jagad
