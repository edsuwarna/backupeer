// Package settings provides application settings management.
package settings

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// Service manages app settings backed by a key-value table.
type Service struct {
	db *sql.DB
}

// NewService creates a new settings service.
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// GetAll returns all settings as a JSON object.
func (s *Service) GetAll() (map[string]string, error) {
	rows, err := s.db.Query(`SELECT key, value FROM app_settings ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan setting: %w", err)
		}
		settings[k] = v
	}
	return settings, nil
}

// UpdateBatch updates multiple settings at once.
func (s *Service) UpdateBatch(settings map[string]string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()

	allowed := map[string]bool{
		"retention_full_default": true,
		"retention_incr_default": true,
		"concurrent_backups":     true,
		"compression":            true,
		"timezone":               true,
		"notify_on_success":      true,
		"notify_on_failure":      true,
	}

	for k, v := range settings {
		if !allowed[k] {
			return fmt.Errorf("unknown setting: %s", k)
		}
		if _, err := stmt.Exec(k, v); err != nil {
			return fmt.Errorf("set %s: %w", k, err)
		}
	}

	return tx.Commit()
}

// Handler handles HTTP requests for settings.
type Handler struct {
	svc     *Service
	version string
}

// NewHandler creates a new settings HTTP handler.
func NewHandler(svc *Service, version string) *Handler {
	return &Handler{svc: svc, version: version}
}

// RegisterRoutes registers settings API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/settings", h.handleGet)
	mux.HandleFunc("PUT /api/settings", h.handleUpdate)
}

func (h *Handler) handleGet(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.GetAll()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if settings == nil {
		settings = make(map[string]string)
	}
	settings["version"] = h.version
	writeJSON(w, http.StatusOK, settings)
}

func (h *Handler) handleUpdate(w http.ResponseWriter, r *http.Request) {
	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if err := h.svc.UpdateBatch(req); err != nil {
		if strings.Contains(err.Error(), "unknown setting") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Return updated settings
	settings, err := h.svc.GetAll()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
