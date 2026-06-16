package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// Service handles user authentication with session management.
type Service struct {
	adminUser string
	adminPass string // SHA-256 hash
	secretKey string
	sessions  map[string]sessionInfo
	mu        sync.RWMutex
}

type sessionInfo struct {
	User      string    `json:"user"`
	ExpiresAt time.Time `json:"expires_at"`
}

func NewService(adminUser, adminPass, secretKey string) *Service {
	h := sha256.Sum256([]byte(adminPass))
	hashedPass := hex.EncodeToString(h[:])

	if secretKey == "" {
		buf := make([]byte, 32)
		rand.Read(buf)
		secretKey = hex.EncodeToString(buf)
	}

	return &Service{
		adminUser: adminUser,
		adminPass: hashedPass,
		secretKey: secretKey,
		sessions:  make(map[string]sessionInfo),
	}
}

// Login validates credentials and returns a session token.
func (s *Service) Login(user, password string) (string, bool) {
	if user != s.adminUser {
		return "", false
	}
	h := sha256.Sum256([]byte(password))
	if hex.EncodeToString(h[:]) != s.adminPass {
		return "", false
	}

	// Generate session token
	buf := make([]byte, 32)
	rand.Read(buf)
	token := hex.EncodeToString(buf)

	s.mu.Lock()
	s.sessions[token] = sessionInfo{
		User:      user,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	s.mu.Unlock()

	return token, true
}

// Validate checks if a session token is valid.
func (s *Service) Validate(token string) bool {
	s.mu.RLock()
	sess, ok := s.sessions[token]
	s.mu.RUnlock()
	if !ok {
		return false
	}
	if time.Now().After(sess.ExpiresAt) {
		s.mu.Lock()
		delete(s.sessions, token)
		s.mu.Unlock()
		return false
	}
	return true
}

// Logout invalidates a session token.
func (s *Service) Logout(token string) {
	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}

// Middleware returns an HTTP handler that checks authentication.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for login, health, and static files
		if r.URL.Path == "/api/auth/login" || r.URL.Path == "/api/health" || r.URL.Path == "/" {
			next.ServeHTTP(w, r)
			return
		}

		token := ""
		if c, err := r.Cookie("session"); err == nil {
			token = c.Value
		}
		if token == "" {
			token = r.Header.Get("Authorization")
		}

		if !s.Validate(token) {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// HandleLogin handles POST /api/auth/login.
func (s *Service) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	token, ok := s.Login(req.Username, req.Password)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400,
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  req.Username,
	})
}

// HandleLogout handles POST /api/auth/logout.
func (s *Service) HandleLogout(w http.ResponseWriter, r *http.Request) {
	token := ""
	if c, err := r.Cookie("session"); err == nil {
		token = c.Value
	}
	s.Logout(token)

	http.SetCookie(w, &http.Cookie{
		Name:   "session",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// HandleCheck handles GET /api/auth/check.
// Returns user info if session is valid.
func (s *Service) HandleCheck(w http.ResponseWriter, r *http.Request) {
	token := ""
	if c, err := r.Cookie("session"); err == nil {
		token = c.Value
	}

	if token == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	s.mu.RLock()
	sess, ok := s.sessions[token]
	s.mu.RUnlock()

	if !ok || time.Now().After(sess.ExpiresAt) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "session expired"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user":   sess.User,
		"expires": sess.ExpiresAt.Format(time.RFC3339),
	})
}

func decodeJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
