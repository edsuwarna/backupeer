package backup

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/edsuwarna/jagad/internal/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/backups", h.handleList)
	mux.HandleFunc("POST /api/backups", h.handleCreate)
	mux.HandleFunc("GET /api/backups/{id}", h.handleGet)
	mux.HandleFunc("DELETE /api/backups/{id}", h.handleDelete)
	mux.HandleFunc("GET /api/backups/{id}/logs", h.handleLogs)
	mux.HandleFunc("GET /api/backups/{id}/download", h.handleDownload)
	mux.HandleFunc("POST /api/backups/{id}/verify", h.handleVerify)
	mux.HandleFunc("GET /api/backups/stats", h.handleStats)
	mux.HandleFunc("GET /api/backups/analytics/trends", h.handleTrends)
	mux.HandleFunc("GET /api/backups/analytics/slowest", h.handleSlowest)
	mux.HandleFunc("GET /api/backups/analytics/freshness", h.handleFreshness)
}

// handleStats returns aggregate backup statistics.
func (h *Handler) handleStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.Stats()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, stats)
}

// handleTrends returns daily backup aggregation for analytics charts.
func (h *Handler) handleTrends(w http.ResponseWriter, r *http.Request) {
	daysStr := r.URL.Query().Get("days")
	days := 30
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 && d <= 365 {
			days = d
		}
	}

	trends, err := h.svc.Trends(days)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, trends)
}

// handleSlowest returns the top N slowest successful backups.
func (h *Handler) handleSlowest(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 10
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	backups, err := h.svc.SlowestBackups(limit)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, backups)
}

// handleFreshness returns databases not backed up within the given threshold.
func (h *Handler) handleFreshness(w http.ResponseWriter, r *http.Request) {
	hoursStr := r.URL.Query().Get("hours")
	hours := 24
	if hoursStr != "" {
		if hh, err := strconv.Atoi(hoursStr); err == nil && hh > 0 {
			hours = hh
		}
	}

	alerts, err := h.svc.Freshness(hours)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, alerts)
}

// handleDownload streams a backup file from storage to the client.
func (h *Handler) handleDownload(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Get backup to build filename
	b, err := h.svc.Get(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if b == nil {
		httputil.WriteError(w, http.StatusNotFound, "backup not found")
		return
	}

	// Set download headers
	w.Header().Set("Content-Type", "application/octet-stream")
	ext := "sql.gz"
	if b.EncryptedSizeBytes != nil && *b.EncryptedSizeBytes > 0 {
		ext = "enc.sql.gz"
	}
	filename := fmt.Sprintf("backup-%s-%s.%s", b.ID[:8], b.BackupType, ext)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	if err := h.svc.Download(id, w); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
}

// handleVerify triggers backup verification.
func (h *Handler) handleVerify(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.StartVerification(id); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "verifying", "backup_id": id})
}

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request) {
	connectionID := r.URL.Query().Get("connection_id")
	databaseID := r.URL.Query().Get("database_id")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	backups, err := h.svc.List(connectionID, databaseID, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if backups == nil {
		backups = []Backup{}
	}
	httputil.WriteJSON(w, http.StatusOK, backups)
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ConnectionID        string   `json:"connection_id"`
		DatabaseID          string   `json:"database_id"`
		BackupType          string   `json:"backup_type"`
		ScheduleID          *string  `json:"schedule_id,omitempty"`
		StorageProviderID   *string  `json:"storage_provider_id,omitempty"`
		NotifTargetIDs      []string `json:"notif_target_ids,omitempty"`
		NotifyOnSuccess     *bool    `json:"notify_on_success,omitempty"`
		NotifyOnFailure     *bool    `json:"notify_on_failure,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Default notification settings
	notifOnSuccess := true
	notifOnFailure := true
	if req.NotifyOnSuccess != nil {
		notifOnSuccess = *req.NotifyOnSuccess
	}
	if req.NotifyOnFailure != nil {
		notifOnFailure = *req.NotifyOnFailure
	}

	b, err := h.svc.StartBackup(req.ConnectionID, req.DatabaseID, req.BackupType, req.ScheduleID, req.StorageProviderID, req.NotifTargetIDs, notifOnSuccess, notifOnFailure)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, b)
}

func (h *Handler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := h.svc.Get(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if b == nil {
		httputil.WriteError(w, http.StatusNotFound, "backup not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, b)
}

func (h *Handler) handleDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(id); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleLogs(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := h.svc.Get(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if b == nil {
		httputil.WriteError(w, http.StatusNotFound, "backup not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"log": b.LogOutput})
}
