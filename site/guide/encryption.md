---
title: 'Encryption'
description: 'AES-256-GCM streaming encryption — how it works, key management, chunk-level nonce, and EOF marking'
---

# Encryption

Jagad provides **end-to-end encryption** for backup data at rest using **AES-256-GCM** with **Argon2id** key derivation. Every backup can be encrypted before it leaves the server, ensuring that data stored in S3-compatible object storage is unreadable without the encryption key.

## Architecture

The encryption system is built on two layers:

1. **Credential encryption** — Storage provider credentials (access keys, secret keys) are encrypted at rest using AES-256-GCM with a key derived from the master key.
2. **Backup data encryption** — Backup dump output is encrypted on-the-fly through a streaming pipeline before being uploaded to object storage.

## AES-256-GCM

Jagad uses **AES-256-GCM** (Galois/Counter Mode) for all encryption operations:

- **Algorithm**: AES with 256-bit key
- **Mode**: GCM (Galois/Counter Mode) — provides both confidentiality and authentication
- **Nonce size**: 12 bytes (96 bits)
- **Authentication tag**: 16 bytes (128 bits) appended to each ciphertext
- **Key derivation**: Argon2id (memory-hard KDF)

### Key Derivation (Argon2id)

Encryption keys are derived from a user-provided master key using **Argon2id**, the memory-hard key derivation function recommended by OWASP and RFC 9106.

```
key = argon2.IDKey(masterKey, salt, time=1, memory=64MB, parallelism=4, keyLen=32)
```

- **Salt**: Random 16 bytes, generated fresh for each operation and stored alongside ciphertext
- **Time cost**: 1 iteration
- **Memory cost**: 64 MiB
- **Parallelism**: 4 threads
- **Output**: 32 bytes (256 bits) — fits AES-256

This means even if two backups use the same master key, they produce different encryption keys (different salt → different key).

## Streaming Encryption (Chunk-Level Framing)

Backup data can be arbitrarily large (many GB or TB). To handle this without loading everything into memory, jagad uses a **chunk-level framing** format that encrypts data in independent frames.

### Stream Format

```
StreamLayout
├── Salt (16 bytes)
├── Frame 1
│   ├── Nonce (12 bytes)
│   ├── Frame Length (4 bytes, big-endian)
│   └── Ciphertext + GCM Tag
├── Frame 2
│   ├── Nonce (12 bytes)
│   ├── Frame Length (4 bytes, big-endian)
│   └── Ciphertext + GCM Tag
├── ...
└── EOF Marker
    └── 16 zero bytes (nonce=0, frameLen=0)
```

### How It Works

1. **Salt prefix**: A random 16-byte salt is generated and written as the first bytes of the encrypted stream. `salt = crypto/rand(16)`

2. **Counter-based nonces**: Each frame uses a unique nonce derived from an incrementing 64-bit counter. The counter starts at 1 (0 is reserved for the EOF marker). Nonce structure: `[counter:8 bytes][zeros:4 bytes]`

3. **Independent frames**: Each Write() call to the encrypter produces one frame. Each frame is independently decryptable — you can seek to any frame and decrypt it without reading previous frames.

4. **Authentication**: GCM authentication tags are appended to each frame's ciphertext by the AES-GCM implementation itself. Tampering with any byte causes decryption to fail.

5. **EOF marker**: A 16-byte zero frame (nonce=12 + frameLen=4, all zeros) signals the end of the stream. The decrypt reader detects this and returns io.EOF.

### Memory Efficiency

The streaming pipeline uses approximately **64 KB of memory** total, regardless of backup size:

- **io.Pipe buffers**: ~32 KB
- **gzip internal buffers**: ~32 KB
- **AES-GCM frame buffer**: one frame at a time

### Why Counter-Based Nonces?

- **No nonce reuse**: Each frame gets a unique nonce (GCM fails catastrophically on nonce reuse).
- **Deterministic**: On decrypt, the nonce is read from the frame header — no need to track state across frames.
- **Seekable**: Each frame is self-describing with its own nonce and length.

## End-to-End Encryption

### Full Backup Encryption Pipeline

```
pg_dump stdout
    │
    ▼
┌─ countWriter (track raw size)
│
▼
gzip compression
    │
    ▼
┌─ SHA-256 hash (for integrity verification)
│
▼
EncryptStream (AES-256-GCM framing)
    │
    ▼
S3 multipart upload
```

The SHA-256 checksum is calculated **before** encryption (on the compressed data). This checksum is stored in the backup metadata and can be verified later by downloading and decrypting the backup.

### Incremental Backup Encryption

For incremental backups via pgBackRest/XtraBackup/Mariabackup, encryption is handled by the respective tool's own encryption capabilities or applied at the storage level.

## Enabling Encryption

### Via Environment Variable

```bash
export JAGAD_ENCRYPTION_KEY="your-encryption-key-here"
```

Or using a file:

```bash
export JAGAD_ENCRYPTION_KEY=$(cat /etc/jagad/encryption.key)
```

### Via Configuration File

```yaml
encryption:
  enabled: true
  key: "your-encryption-key-here"
```

### Via Web UI

1. Go to **Settings > Encryption**
2. Toggle **Enable Encryption**
3. Enter your encryption key
4. Save

> **Important**: If you lose the encryption key, your backups cannot be decrypted. Store the key in a secure location such as a password manager, Vault, or AWS Secrets Manager.

## Key Management

### Master Key

The master key used for credential encryption is set via `JAGAD_MASTER_KEY` environment variable. If not provided, a default key is used (minimal security). **Always set a strong master key in production.**

```bash
export JAGAD_MASTER_KEY="your-strong-master-key"
```

### Encryption Key

The encryption key for backup data is set via `JAGAD_ENCRYPTION_KEY`. This key is used with Argon2id key derivation to produce the actual AES-256 key.

### Rotation

To rotate keys:

1. **Change the encryption key** in settings
2. **New backups** will use the new key
3. **Existing backups** remain encrypted with the old key — keep the old key accessible for restores

## Security Considerations

- **Nonce never reused**: The counter-based nonce system guarantees unique nonces across the entire stream.
- **Authentication**: GCM provides built-in authentication — tampering is detected immediately.
- **Key separation**: Backup data encryption key is separate from credential encryption key.
- **Memory-hard KDF**: Argon2id provides resistance against GPU/ASIC brute-force attacks.
- **No plaintext on disk**: Encryption and compression happen entirely in streaming memory — no temporary files.
