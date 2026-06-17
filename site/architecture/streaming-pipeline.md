---
title: 'Streaming Pipeline'
---

# Streaming Pipeline

The streaming pipeline is the architectural centerpiece of Jagad. It enables **unlimited database sizes** with **constant memory usage** by piping data directly from the database dump tool through compression, encryption, and upload to S3 — all without touching disk.

This document provides a comprehensive deep dive into how the pipeline works, why it's designed this way, and the guarantees it provides.

---

## The Problem: Traditional Backup Tools

Most backup tools and scripts follow this pattern:

```bash
# Step 1: Dump to disk
pg_dump mydb > /tmp/backup.sql

# Step 2: Compress
gzip /tmp/backup.sql

# Step 3: Encrypt
gpg -c /tmp/backup.sql.gz

# Step 4: Upload to S3
aws s3 cp /tmp/backup.sql.gz.gpg s3://bucket/backups/
```

**Problems with this approach:**
- Requires **2x the database size** in disk space (dump file + compressed file)
- High disk I/O contention with the production database
- Long cleanup on failure (orphaned temp files)
- Unbounded memory usage if buffering in RAM
- Fails entirely on large databases when disk fills up

---

## The Solution: io.Pipe Streaming

Jagad replaces the entire disk-based pipeline with a chain of `io.Pipe` connections:

```
pg_dump stdout ──▶ gzip ──▶ AES-256-GCM ──▶ S3 Multipart Upload
                        (all via io.Pipe, zero disk I/O)
```

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Streaming Pipeline                              │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────┐ │
│  │   pg_dump/    │    │   TeeReader   │    │   Gzip       │    │  io.   │ │
│  │   mysqldump   │───▶│  (count raw   │───▶│   Writer     │───▶│  Pipe  │──┐
│  │   (stdout)    │    │    bytes)     │    │              │    │        │  │
│  └──────────────┘    └──────────────┘    └───────┬───────┘    └────────┘  │
│                                                   │                       │
│                                          ┌────────▼────────┐             │
│                                          │  io.MultiWriter  │             │
│                                          │  (fan-out)       │             │
│                                          └──┬──────────┬────┘             │
│                                             │          │                  │
│                                    ┌────────▼──┐ ┌─────▼──────┐          │
│                                    │ sha256    │ │EncryptStream│          │
│                                    │ Hash      │ │(AES-256-   │          │
│                                    │ (checksum)│ │ GCM framed)│          │
│                                    └───────────┘ └─────┬──────┘          │
│                                                         │                │
│                                                 ┌───────▼──────┐        │
│                                                 │  io.Pipe     │        │
│                                                 │  (to S3)     │        │
│                                                 └───────┬──────┘        │
│                                                         │                │
│  ┌──────────────┐    ┌──────────────────────────────────┘                │
│  │  S3 Upload   │◄───│    minio-go PutObject(size=-1)                     │
│  │  (Multipart) │    │    → auto 5 MiB parts                             │
│  └──────────────┘    └───────────────────────────────────────────────────┘
│                                                                         │
│  Memory: ~64 KB peak (gzip window + pipe buffer + encrypt frame)        │
│  Disk:   ZERO bytes written at any point                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### Detailed Flow

```
                       ┌───────────────────────┐
                       │    Backup Service      │
                       │  (runFullBackup)       │
                       └───────────┬───────────┘
                                   │
                  ┌────────────────▼────────────────┐
                  │                                 │
          ┌───────▼────────┐              ┌─────────▼──────────┐
          │ dumpCmd.Start() │              │  Create io.Pipe()  │
          │ (stdout pipe)   │              │  (pr, pw)          │
          └───────┬────────┘              └─────────┬──────────┘
                  │                                 │
                  │ stdout                          │ pw (write end)
                  ▼                                 ▼
          ┌───────────────────────────────────────────────┐
          │           Goroutine (compression/encryption)  │
          │                                               │
          │  dumpReader = io.TeeReader(stdout, &countW)   │
          │                                               │
          │  if encryption enabled:                       │
          │    encWriter = encSvc.EncryptStream(pw)        │
          │    gw = gzip.NewWriter(                        │
          │           io.MultiWriter(hashWriter,           │
          │                            encWriter))         │
          │  else:                                         │
          │    gw = gzip.NewWriter(                        │
          │           io.MultiWriter(hashWriter, pw))      │
          │                                               │
          │  io.Copy(gw, dumpReader)  ← blocks until      │
          │                              all data read    │
          │  gw.Close()               ← flushes gzip      │
          │  encWriter.Close()        ← writes EOF frame  │
          │  pw.Close()               ← signals EOF to S3 │
          └───────────────────────────────────────────────┘
                  │                         │
                  │ pr (read end)            │
                  ▼                         ▼
          ┌───────────────────────────────────────┐
          │  storageSvc.UploadStream(ctx,key,pr)  │
          │  → minio PutObject(size=-1)           │
          │  → triggers multipart upload with     │
          │    5 MiB parts                        │
          └───────────────────────────────────────┘
                  │
                  ▼
          ┌───────────────────────────────────────┐
          │  dumpCmd.Wait()                       │
          │  Store checksum & metadata to SQLite  │
          └───────────────────────────────────────┘
```

---

## Why No Disk Buffer?

The key insight is that `io.Pipe` in Go provides an **in-memory pipe** that behaves like a Unix pipe. Data written to the write end is buffered in a **small internal buffer (default ~32 KB)** and made available immediately on the read end. When the read end is consumed by S3 upload, the pipe acts as a bounded buffer with natural backpressure.

**The chain works because all stages operate concurrently:**
1. `pg_dump` writes to its stdout (blocked when pipe buffer is full)
2. The goroutine reads from stdout, compresses, encrypts, and writes to the pipe
3. `UploadStream` reads from the pipe and writes to S3

If S3 is slow, backpressure propagates all the way back to `pg_dump`, which simply waits. If `pg_dump` produces data faster than S3 can consume, the pipe buffer fills and blocks `pg_dump`.

**Result:** At most ~64 KB of data is in-flight at any time (gzip window + pipe buffer + encrypt frame), regardless of database size.

### Memory Profile Under Load

| Component | Buffer Size | Notes |
|---|---|---|
| `io.Pipe` internal buffer | ~32 KB | Default Go pipe buffer |
| `gzip.Writer` | ~32 KB | Default compression window |
| `EncryptWriter` frame | ~16 KB | Configurable, default 16 KB chunks |
| S3 upload buffer | ~5 MiB | MinIO multipart part buffer (in separate goroutine) |
| **Total peak (excluding S3 buffer)** | **~64 KB** | Data in flight through the pipeline |
| **Total peak (with S3 buffer)** | **~5.1 MB** | One multipart part in upload, rest streaming |

> The S3 upload buffer is consumed by the MinIO SDK in a separate goroutine and is not part of the streaming pipeline's working set. The pipeline itself uses only ~64 KB.

### What About a 1 TB Database?

A 1 TB database backed up via this pipeline:
- **Memory:** ~64 KB (same as a 1 MB database)
- **Disk:** 0 bytes written by Jagad
- **Network:** ~1 TB of compressed data sent to S3 (compression ratio depends on data)
- **Time:** Limited by dump speed, compression speed, and upload bandwidth — not by I/O

---

## How Backpressure Works

Backpressure is the mechanism that prevents any stage in the pipeline from being overwhelmed. It's automatic in Go's `io.Pipe`:

```
pg_dump ──▶ Pipe(32KB) ──▶ gzip ──▶ Pipe(32KB) ──▶ encrypt ──▶ Pipe(32KB) ──▶ S3
  │            │                      │                         │
  │            ▼                      ▼                         ▼
  │     When full:              When full:                When full:
  │     pg_dump blocks           gzip blocks              encrypt blocks
  │     on stdout write          on Pipe.Write             on Pipe.Write
  │                                                                    
  │            ▲                      ▲                         ▲
  │            │                      │                         │
  │     When empty:             When empty:               When empty:
  │     goroutine blocks        gzip reads more            encrypt reads
  │     on Pipe.Read            from stdout                from gzip output
```

**Key insight:** Because all stages are connected via synchronous pipes, the entire chain naturally rate-limits itself to the slowest stage. There is no unbounded queue, no memory ballooning, and no OOM risk.

---

## Encryption Framing for Streaming

Standard AES-GCM is not directly usable for streaming because it requires the entire plaintext to produce the authentication tag. Jagad uses a **chunked framing format** that makes each chunk independently decryptable.

### Stream Format

```
┌─────────────────────────────────────────────────────────────────┐
│                    Encrypted Stream Format                        │
│                                                                  │
│  ┌──────────┐  ┌───────────────────────┐  ┌──────────────────┐   │
│  │  Salt     │  │  Data Frame 1         │  │  Data Frame N    │   │
│  │  (16 B)   │  │                       │  │                  │   │
│  └──────────┘  │  ┌──────┐ ┌────┐ ┌───┐ │  │  ┌──────┐ ┌──┐ │   │
│                │  │Nonce │ │Len │ │CT │ │  │  │Nonce │ │0 │ │   │
│                │  │12 B  │ │4 B │ │.. │ │  │  │12 B  │ │4 │ │   │
│                │  └──────┘ └────┘ └───┘ │  │  └──────┘ └──┘ │   │
│                └───────────────────────┘  └──────────────────┘   │
│                                                                  │
│  Salt: Random per stream, used with master key → derived key     │
│  Nonce: Counter-based (8 bytes big-endian + 4 zero bytes)        │
│  Len: Big-endian uint32 frame length                             │
│  CT: AES-256-GCM ciphertext + 16-byte authentication tag         │
│  EOF: Frame with Len=0 (nonce is ignored, counter starts at 1)   │
└─────────────────────────────────────────────────────────────────┘
```

### EncryptStream (Writer side)

```go
func (w *encryptWriter) Write(p []byte) (int, error) {
    // Build nonce from counter (8 bytes big-endian) + 4 zero bytes
    var nonce [12]byte
    binary.BigEndian.PutUint64(nonce[:8], w.counter)
    w.counter++

    // Encrypt chunk with AES-256-GCM
    ciphertext := w.gcm.Seal(nil, nonce[:], p, nil)

    // Write frame header + ciphertext
    var header [frameHeaderSize]byte  // 16 bytes
    copy(header[:12], nonce[:])
    binary.BigEndian.PutUint32(header[12:16], uint32(len(ciphertext)))
    w.dst.Write(header[:])
    w.dst.Write(ciphertext)

    return len(p), nil
}

func (w *encryptWriter) Close() error {
    // Write EOF marker: zero frameLen = 16 zero bytes
    var eof [frameHeaderSize]byte
    _, err := w.dst.Write(eof[:])
    return err
}
```

### DecryptStream (Reader side)

```go
func (r *decryptReader) Read(p []byte) (int, error) {
    // Read frame header
    var header [16]byte
    io.ReadFull(r.src, header[:])

    frameLen := binary.BigEndian.Uint32(header[12:16])

    // Check for EOF marker
    if frameLen == 0 {
        r.done = true
        return 0, io.EOF
    }

    // Read ciphertext
    ciphertext := make([]byte, frameLen)
    io.ReadFull(r.src, ciphertext)

    // Decrypt with nonce from header
    plaintext, r.gcm.Open(r.buf[:0], header[:12], ciphertext, nil)
    // ...return plaintext
}
```

### Why This Framing?

| Property | Benefit |
|---|---|
| **Counter-based nonces** | Deterministic, no reuse risk, no random number generation per frame |
| **Independent frames** | Each frame decrypts independently — seekable, parallel decryptable |
| **Explicit EOF marker** | No ambiguity about stream end, no need for out-of-band signaling |
| **Length prefix** | Decoder knows exactly how much to read per frame |
| **Per-stream random salt** | Unique derived key per stream even with same master key |
| **GCM authentication tag** | Tampering detected immediately at frame boundary (not end-of-file) |

---

## Hash Verification During Upload

Jagad computes a **SHA-256 checksum of the compressed data** (before encryption) during the upload, using an `io.TeeReader` and `io.MultiWriter` pattern:

### How It Works

```
stdout ──▶ TeeReader ──▶ gzip ──▶ MultiWriter ──┬──▶ sha256.Hash
                              │                  │
                              │                  └──▶ encrypt ──▶ S3
                              │
                              └── countWriter (track raw size)
```

**Code architecture:**

```go
// Count raw dump bytes before compression
dumpReader := io.TeeReader(stdout, &countWriter{&rawSize})

// Pipeline: dump → gzip → SHA256 + encrypt → pw → S3
encWriter, _ := s.encSvc.EncryptStream(pw, "default")
gw := gzip.NewWriter(io.MultiWriter(hashWriter, encWriter))
io.Copy(gw, dumpReader)
gw.Close()
encWriter.Close()
pw.Close()
```

**Verification flow:**

1. `io.TeeReader` duplicates dump stdout: data flows to gzip while counting raw bytes
2. `io.MultiWriter` fans out compressed data: one copy goes to SHA-256, the other to encryption
3. The SHA-256 hash is computed **as data flows through** — no separate pass needed
4. After upload completes, the checksum is stored in SQLite: `backup.Checksum`
5. For restore, the checksum can be verified against the downloaded & decrypted data

**Important distinction:** The checksum is of the **compressed data**, not the encrypted data. This means:
- Two backups of the same database with the same content but different encryption salts will have **the same checksum** (compressed data is identical)
- Verification can happen before decryption (decompress → hash → compare)

### Verification on Restore

```go
// 1. Download from S3
data := download(b.StoragePath)

// 2. Decrypt (if encrypted)
plaintext := decrypt(data)

// 3. Verify checksum
hash := sha256.Sum256(plaintext)
if hex.EncodeToString(hash[:]) != b.Checksum {
    return error("checksum mismatch — data corrupted")
}

// 4. Decompress
decompressed := gunzip(plaintext)

// 5. Pipe to restore command
executeRestore(conn, decompressed)
```

---

## S3 Multipart Upload Integration

The MinIO SDK automatically handles multipart upload when the content size is unknown (passed as `-1`):

```go
func (s *S3Client) UploadStream(ctx context.Context, key string, reader io.Reader) error {
    _, err := s.client.PutObject(ctx, s.cfg.Bucket, key, reader, -1, minio.PutObjectOptions{})
    return err
}
```

**How multipart upload works:**

1. MinIO SDK reads from the `io.Pipe` reader in 5 MiB chunks
2. Each chunk is uploaded as a separate part (concurrent by default with 2 goroutines)
3. Part ETags are collected
4. After the reader returns EOF, parts are assembled into the final object
5. On failure, uploaded parts are garbage-collected by S3

This adds only ~5 MB of additional buffering (one part) on top of the pipeline's ~64 KB.

---

## Code Architecture Summary

```go
// backup/service.go — the streaming pipeline orchestrator

func (s *Service) runFullBackup(b *Backup, conn *connection.Connection,
    db *connection.ConnectionDatabase, prov *storage.Provider, startTime time.Time) {

    // 1. Start dump process with stdout pipe
    dumpCmd := s.buildDumpCmd(conn, db.DBName)
    stdout, _ := dumpCmd.StdoutPipe()
    dumpCmd.Start()

    // 2. Create pipe for S3 upload
    pr, pw := io.Pipe()
    errChan := make(chan error, 1)

    // 3. Goroutine: compress + encrypt + hash
    go func() {
        defer pw.Close()
        hashWriter := sha256.New()
        var rawSize int64
        dumpReader := io.TeeReader(stdout, &countWriter{&rawSize})

        if s.encSvc != nil {
            encWriter, _ := s.encSvc.EncryptStream(pw, "default")
            gw := gzip.NewWriter(io.MultiWriter(hashWriter, encWriter))
            io.Copy(gw, dumpReader)
            gw.Close()
            encWriter.Close()
        } else {
            gw := gzip.NewWriter(io.MultiWriter(hashWriter, pw))
            io.Copy(gw, dumpReader)
            gw.Close()
        }
        errChan <- nil
    }()

    // 4. S3 upload (blocks until pipe closes)
    storageSvc.UploadStream(ctx, key, pr)

    // 5. Wait for compression goroutine
    <-errChan

    // 6. Wait for dump process
    dumpCmd.Wait()

    // 7. Store checksum and metadata
    b.Checksum = hex.EncodeToString(hashWriter.Sum(nil))
    b.SizeBytes = &rawSize
    s.completeBackup(b, conn, db, logBuf.String(), startTime, &prov.ID)
}
```

### Key Interfaces

| Interface | Role | Implementation |
|---|---|---|
| `io.Pipe` | Bounded in-memory byte stream between goroutines | Standard library |
| `io.TeeReader` | Duplicate stream for byte counting | `dumpReader = io.TeeReader(stdout, &countW)` |
| `io.MultiWriter` | Fan-out compressed data to hash + encrypt | `io.MultiWriter(hashWriter, encWriter)` |
| `encryption.EncryptStream` | Framed AES-256-GCM encryption | `internal/encryption/service.go` |
| `encryption.DecryptStream` | Framed AES-256-GCM decryption | `internal/encryption/service.go` |
| `storage.UploadStream` | S3 multipart upload with unknown size | `internal/storage/s3.go` |

---

## Performance Characteristics

### Throughput Bottlenecks

| Stage | Typical Throughput | Constraint |
|---|---|---|
| `pg_dump` | 100-500 MB/s raw | Database read + network |
| `gzip` level 6 | 50-200 MB/s raw input | CPU (single core) |
| AES-256-GCM | 200-500 MB/s | CPU (AES-NI accelerated on modern CPUs) |
| S3 upload | 10-100 MB/s | Network bandwidth + S3 API limits |

**Typical bottleneck:** Network upload to S3 is almost always the limiting factor for large databases.

### What About Compression?

- `pg_dump --format=c` (custom format) already applies some compression internally
- gzip on top typically achieves 2-5x additional compression on SQL text
- For `pg_dump --format=c`, the combined compression ratio is typically 3-8x
- In aggregate tests, a 100 GB database produces ~15-30 GB of compressed+encrypted output

---

## Edge Cases & Error Handling

### What if S3 Upload Fails Mid-Stream?

```go
if uploadErr := storageSvc.UploadStream(ctx, key, pr); uploadErr != nil {
    pr.Close()                    // Break the pipe
    <-errChan                     // Drain the goroutine
    dumpCmd.Process.Kill()        // Kill the dump process
    dumpCmd.Wait()                // Clean up zombie process
    s.failBackup(b, log)          // Mark backup as failed
}
```

The pipe is explicitly closed on error, which causes the writing goroutine to unblock (its `pw.Write` will return `io.ErrClosedPipe`). The dump process is killed to prevent orphan processes.

### What if the Database Connection Drops During Dump?

The dump tool's stdout pipe will return an error, which propagates through gzip → encrypt → pipe → S3. MinIO will detect the incomplete upload and clean up the partial parts. The backup is marked as failed with the error logged.

### What if Encryption Key is Wrong?

GCM authentication will fail at the first decrypted frame boundary during restore. The error is immediate and clear: `"decrypt frame: cipher: message authentication failed"`. No silent corruption.

---

## Comparison: Streaming vs. Disk-Based

| Aspect | Disk-Based (Traditional) | Streaming (Jagad) |
|---|---|---|
| Disk space | 2x DB size (dump + compress) | **0 bytes** |
| Peak memory | Unbounded (depends on tool) | **~64 KB** |
| Max DB size | Limited by free disk | **Unlimited** |
| Cleanup on failure | Manual (orphan temp files) | **Automatic** (nothing to clean) |
| I/O contention | High (competing with DB) | **None** |
| Restore speed | Fast (local file) | Slower (must download from S3) |
| Complexity | Simple (shell script) | Moderate (goroutine coordination) |

---

## Related

- [Architecture Overview](./overview) — System architecture and component interactions
- [Security Model](./security) — Encryption algorithm details and key management
- [Incremental Backup](./incremental-backup) — Alternative pipeline for incremental backups
