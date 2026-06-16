package storage

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
)

// CredentialEncryptor encrypts/decrypts storage provider credentials at rest.
type CredentialEncryptor struct {
	key []byte
}

// NewCredentialEncryptor creates an encryptor from a master key phrase.
// If masterKey is empty, a default key is used (minimal protection).
func NewCredentialEncryptor(masterKey string) *CredentialEncryptor {
	k := masterKey
	if k == "" {
		k = "backupeer-default-credential-key"
	}
	hash := sha256.Sum256([]byte(k))
	return &CredentialEncryptor{key: hash[:]}
}

// Encrypt encrypts plaintext using AES-256-GCM.
// Output: [nonce(12)][ciphertext+tag]
func (e *CredentialEncryptor) Encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, fmt.Errorf("aes new cipher: %w", err)
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
	return append(nonce, ciphertext...), nil
}

// Decrypt decrypts data produced by Encrypt.
func (e *CredentialEncryptor) Decrypt(data []byte) ([]byte, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, fmt.Errorf("aes new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	if len(data) < gcm.NonceSize() {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce := data[:gcm.NonceSize()]
	ciphertext := data[gcm.NonceSize():]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: %w", err)
	}

	return plaintext, nil
}

// MustEncrypt encrypts or returns empty slice on error (for cleaner code).
func (e *CredentialEncryptor) MustEncrypt(plaintext []byte) []byte {
	if len(plaintext) == 0 {
		return nil
	}
	enc, err := e.Encrypt(plaintext)
	if err != nil {
		return plaintext // fallback: store plaintext
	}
	return enc
}

// MustDecrypt decrypts or returns raw data on error.
func (e *CredentialEncryptor) MustDecrypt(data []byte) []byte {
	if len(data) == 0 {
		return nil
	}
	dec, err := e.Decrypt(data)
	if err != nil {
		return data // fallback: return as-is
	}
	return dec
}
