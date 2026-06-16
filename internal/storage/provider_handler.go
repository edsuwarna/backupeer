package storage

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/edsuwarna/backupeer/internal/httputil"
)

// ProviderHandler handles HTTP requests for storage provider management.
type ProviderHandler struct {
	svc *ProviderService
}

func NewProviderHandler(svc *ProviderService) *ProviderHandler {
	return &ProviderHandler{svc: svc}
}

func (h *ProviderHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/storage-providers", h.handleList)
	mux.HandleFunc("POST /api/storage-providers", h.handleCreate)
	mux.HandleFunc("GET /api/storage-providers/{id}", h.handleGet)
	mux.HandleFunc("PUT /api/storage-providers/{id}", h.handleUpdate)
	mux.HandleFunc("DELETE /api/storage-providers/{id}", h.handleDelete)
	mux.HandleFunc("POST /api/storage-providers/{id}/test", h.handleTest)
	mux.HandleFunc("POST /api/storage-providers/{id}/set-default", h.handleSetDefault)
}

func (h *ProviderHandler) handleList(w http.ResponseWriter, r *http.Request) {
	providers, err := h.svc.List()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if providers == nil {
		providers = []Provider{}
	}
	httputil.WriteJSON(w, http.StatusOK, providers)
}

func (h *ProviderHandler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var p Provider
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.Create(&p); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, p)
}

func (h *ProviderHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, err := h.svc.GetByID(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if p == nil {
		httputil.WriteError(w, http.StatusNotFound, "provider not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, p)
}

func (h *ProviderHandler) handleUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var p Provider
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	p.ID = id

	if err := h.svc.Update(&p); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, p)
}

func (h *ProviderHandler) handleDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(id); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ProviderHandler) handleTest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Get decrypted provider
	p, err := h.svc.GetDecrypted(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if p == nil {
		httputil.WriteError(w, http.StatusNotFound, "provider not found")
		return
	}

	// Test connection
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := h.svc.TestConnection(ctx, p); err != nil {
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Connection successful",
	})
}

func (h *ProviderHandler) handleSetDefault(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	p, err := h.svc.GetByID(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if p == nil {
		httputil.WriteError(w, http.StatusNotFound, "provider not found")
		return
	}

	p.IsDefault = true
	if err := h.svc.Update(p); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, p)
}
