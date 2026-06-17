package notification

import (
	"encoding/json"
	"net/http"

	"github.com/edsuwarna/jagad/internal/httputil"
)

// Handler handles HTTP requests for notification channel management.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/notifications", h.handleList)
	mux.HandleFunc("POST /api/notifications", h.handleCreate)
	mux.HandleFunc("GET /api/notifications/{id}", h.handleGet)
	mux.HandleFunc("PUT /api/notifications/{id}", h.handleUpdate)
	mux.HandleFunc("DELETE /api/notifications/{id}", h.handleDelete)
	mux.HandleFunc("POST /api/notifications/{id}/test", h.handleTest)
}

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request) {
	notifs, err := h.svc.repo.List()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if notifs == nil {
		notifs = []Notification{}
	}
	httputil.WriteJSON(w, http.StatusOK, notifs)
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var n Notification
	if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if n.Name == "" {
		httputil.WriteError(w, http.StatusBadRequest, "name is required")
		return
	}
	if n.NotifType == "" {
		httputil.WriteError(w, http.StatusBadRequest, "notif_type is required")
		return
	}
	if n.ConfigJSON == "" || n.ConfigJSON == "{}" {
		httputil.WriteError(w, http.StatusBadRequest, "config_json is required")
		return
	}

	if err := h.svc.repo.Create(&n); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, n)
}

func (h *Handler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	n, err := h.svc.repo.GetByID(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n == nil {
		httputil.WriteError(w, http.StatusNotFound, "notification not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, n)
}

func (h *Handler) handleUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var n Notification
	if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	n.ID = id

	if err := h.svc.repo.Update(&n); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, n)
}

func (h *Handler) handleDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.repo.Delete(id); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleTest sends a test notification to verify the channel works.
func (h *Handler) handleTest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	n, err := h.svc.repo.GetByID(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n == nil {
		httputil.WriteError(w, http.StatusNotFound, "notification not found")
		return
	}

	h.svc.NotifyBackupResult([]string{id}, n.ID, "test-db", "test", "success", 1048576, 5000, "Test notification from Jagad")

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}
