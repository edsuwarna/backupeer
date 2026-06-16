package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
)

// Service defines the interface for backup encryption/decryption.
type Service interface {
	Encrypt(plaintext []byte, keyID string) ([]byte, error)
	Decrypt(ciphertext []byte, keyID string) ([]byte, error)
	EncryptStream(dst io.Writer, keyID string) (io.WriteCloser, error)
	DecryptStream(src io.Reader, keyID string) (io.Reader, error)
	GenerateKey(masterKey []byte, salt []byte) ([]byte, []byte, error)
	Checksum(data []byte) string
}

// aesgcm implements Service using AES-256-GCM with Argon2id key derivation.
type aesgcm struct {
	masterKey []byte
}

// NewAESGCMService creates a new AES-256-GCM encryption service.
// masterKey is the base key material; Argon2id derives the actual encryption key.
func NewAESGCMService(masterKey []byte) Service {
	return &aesgcm{masterKey: masterKey}
}

// Encrypt encrypts plaintext using AES-256-GCM.
// Output: [salt (16 bytes)][nonce (12 bytes)][ciphertext+tag]
func (a *aesgcm) Encrypt(plaintext []byte, keyID string) ([]byte, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("generate salt: %w", err)
	}

	key := a.deriveKey(salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	// Format: salt || nonce || ciphertext
	result := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
	result = append(result, salt...)
	result = append(result, nonce...)
	result = append(result, ciphertext...)

	return result, nil
}

// Decrypt decrypts ciphertext that was produced by Encrypt.
func (a *aesgcm) Decrypt(ciphertext []byte, keyID string) ([]byte, error) {
	if len(ciphertext) < 28 { // salt(16) + nonce(12)
		return nil, fmt.Errorf("ciphertext too short")
	}

	salt := ciphertext[:16]
	nonce := ciphertext[16:28]
	encrypted := ciphertext[28:]

	key := a.deriveKey(salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, encrypted, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: %w", err)
	}

	return plaintext, nil
}

// EncryptStream returns a WriteCloser that encrypts data before writing to dst.
// Uses a simpler framing: salt + nonce + streaming chunks.
func (a *aesgcm) EncryptStream(dst io.Writer, keyID string) (io.WriteCloser, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("generate salt: %w", err)
	}

	key := a.deriveKey(salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	// Write salt + nonce prefix
	if _, err := dst.Write(salt); err != nil {
		return nil, fmt.Errorf("write salt: %w", err)
	}
	if _, err := dst.Write(nonce); err != nil {
		return nil, fmt.Errorf("write nonce: %w", err)
	}

	return &encryptWriter{
		dst:   dst,
		gcm:   gcm,
		nonce: nonce,
	}, nil
}

// DecryptStream returns a Reader that decrypts data while reading.
func (a *aesgcm) DecryptStream(src io.Reader, keyID string) (io.Reader, error) {
	salt := make([]byte, 16)
	if _, err := io.ReadFull(src, salt); err != nil {
		return nil, fmt.Errorf("read salt: %w", err)
	}

	key := a.deriveKey(salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(src, nonce); err != nil {
		return nil, fmt.Errorf("read nonce: %w", err)
	}

	return &decryptReader{
		src:   src,
		gcm:   gcm,
		nonce: nonce,
	}, nil
}

// GenerateKey derives a new encryption key using Argon2id.
func (a *aesgcm) GenerateKey(masterKey []byte, salt []byte) ([]byte, []byte, error) {
	if len(salt) == 0 {
		salt = make([]byte, 16)
		if _, err := rand.Read(salt); err != nil {
			return nil, nil, fmt.Errorf("generate salt: %w", err)
		}
	}
	key := argon2.IDKey(masterKey, salt, 1, 64*1024, 4, 32)
	return key, salt, nil
}

// Checksum returns SHA-256 hex checksum of data.
func (a *aesgcm) Checksum(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

func (a *aesgcm) deriveKey(salt []byte) []byte {
	return argon2.IDKey(a.masterKey, salt, 1, 64*1024, 4, 32)
}

// encryptWriter wraps gcm.Seal in a WriteCloser.
type encryptWriter struct {
	dst   io.Writer
	gcm   cipher.AEAD
	nonce []byte
	buf   []byte
}

func (w *encryptWriter) Write(p []byte) (int, error) {
	// Simple approach: encrypt each write as a chunk
	ciphertext := w.gcm.Seal(nil, w.nonce, p, nil)
	_, err := w.dst.Write(ciphertext)
	if err != nil {
		return 0, err
	}
	return len(p), nil // report all plaintext bytes written
}

func (w *encryptWriter) Close() error {
	return nil
}

// decryptReader wraps gcm.Open in a Reader.
type decryptReader struct {
	src   io.Reader
	gcm   cipher.AEAD
	nonce []byte
	buf   []byte
}

func (r *decryptReader) Read(p []byte) (int, error) {
	tmp := make([]byte, len(p)+r.gcm.Overhead())
	n, err := r.src.Read(tmp)
	if err != nil {
		return 0, err
	}

	plaintext, err := r.gcm.Open(r.buf[:0], r.nonce, tmp[:n], nil)
	if err != nil {
		return 0, fmt.Errorf("decrypt stream: %w", err)
	}

	copy(p, plaintext)
	return len(plaintext), nil
}
