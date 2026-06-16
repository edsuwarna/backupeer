package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
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
// Uses counter-based nonce with chunk framing so each chunk is independently decryptable.
// Stream format: [salt:16][frame:([nonce:12][frameLen:4][ciphertext])*][EOF frame:(nonce=0,frameLen=0)]
// Each frame uses AES-256-GCM with a unique nonce (counter-based, no reuse).
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

	// Write salt prefix
	if _, err := dst.Write(salt); err != nil {
		return nil, fmt.Errorf("write salt: %w", err)
	}

	// counter starts at 1 (0 is reserved for EOF marker)
	return &encryptWriter{
		dst:     dst,
		gcm:     gcm,
		counter: 1,
	}, nil
}

// DecryptStream returns a Reader that decrypts data while reading.
// Reads the framing format produced by EncryptStream:
// [salt:16][([nonce:12][frameLen:4][ciphertext])*][EOF]
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

	return &decryptReader{
		src: src,
		gcm: gcm,
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

// encryptWriter wraps gcm.Seal in a framed WriteCloser with counter-based nonces.
// Each Write call produces an independently decryptable frame:
// [nonce:12][frameLen:4][ciphertext]
type encryptWriter struct {
	dst     io.Writer
	gcm     cipher.AEAD
	counter uint64
}

// frameHeaderSize is nonce(12) + frameLen(4)
const frameHeaderSize = 16

func (w *encryptWriter) Write(p []byte) (int, error) {
	// Build nonce from counter (8 bytes big-endian) + 4 zero bytes
	var nonce [12]byte
	binary.BigEndian.PutUint64(nonce[:8], w.counter)
	w.counter++

	ciphertext := w.gcm.Seal(nil, nonce[:], p, nil)

	// Write header: nonce(12) + frameLen(4)
	var header [frameHeaderSize]byte
	copy(header[:12], nonce[:])
	binary.BigEndian.PutUint32(header[12:16], uint32(len(ciphertext)))

	if _, err := w.dst.Write(header[:]); err != nil {
		return 0, fmt.Errorf("encrypt frame header: %w", err)
	}
	if _, err := w.dst.Write(ciphertext); err != nil {
		return 0, fmt.Errorf("encrypt frame data: %w", err)
	}

	return len(p), nil
}

func (w *encryptWriter) Close() error {
	// Write EOF marker: zero nonce + zero frameLen = 16 zero bytes
	var eof [frameHeaderSize]byte
	_, err := w.dst.Write(eof[:])
	return err
}

// decryptReader reads framed encrypted chunks, decrypts them on the fly.
// Each chunk is independently decrypted using the nonce from its frame header.
type decryptReader struct {
	src  io.Reader
	gcm  cipher.AEAD
	done bool
	buf  []byte
	pos  int
}

func (r *decryptReader) Read(p []byte) (int, error) {
	// Return buffered plaintext first
	if r.pos < len(r.buf) {
		n := copy(p, r.buf[r.pos:])
		r.pos += n
		return n, nil
	}
	if r.done {
		return 0, io.EOF
	}

	// Read frame header: nonce(12) + frameLen(4)
	var header [frameHeaderSize]byte
	if _, err := io.ReadFull(r.src, header[:]); err != nil {
		return 0, fmt.Errorf("read frame header: %w", err)
	}

	frameLen := binary.BigEndian.Uint32(header[12:16])

	// EOF marker: nonce==0 && frameLen==0 OR just frameLen==0
	if frameLen == 0 {
		r.done = true
		return 0, io.EOF
	}

	// Read ciphertext
	ciphertext := make([]byte, frameLen)
	if _, err := io.ReadFull(r.src, ciphertext); err != nil {
		return 0, fmt.Errorf("read frame data: %w", err)
	}

	// Decrypt with the nonce from the header
	plaintext, err := r.gcm.Open(r.buf[:0], header[:12], ciphertext, nil)
	if err != nil {
		return 0, fmt.Errorf("decrypt frame: %w", err)
	}

	r.buf = plaintext
	r.pos = 0

	n := copy(p, r.buf)
	r.pos = n
	return n, nil
}
