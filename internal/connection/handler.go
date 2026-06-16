package connection

import (
	"encoding/json"
	"net/http"

	"github.com/edsuwarna/backupeer/internal/httputil"
)

// Handler serves HTTP endpoints for connection management.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/connections", h.handleList)
	mux.HandleFunc("POST /api/connections", h.handleCreate)
	mux.HandleFunc("GET /api/connections/{id}", h.handleGet)
	mux.HandleFunc("PUT /api/connections/{id}", h.handleUpdate)
	mux.HandleFunc("DELETE /api/connections/{id}", h.handleDelete)
	mux.HandleFunc("POST /api/connections/{id}/test", h.handleTest)
	mux.HandleFunc("GET /api/connections/{id}/databases", h.handleListDatabases)
	mux.HandleFunc("POST /api/connections/{id}/discover", h.handleDiscover)
	mux.HandleFunc("PUT /api/connections/databases/{id}", h.handleUpdateDatabase)
}

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request) {
	conns, err := h.svc.List()
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if conns == nil {
		conns = []Connection{}
	}
	httputil.WriteJSON(w, http.StatusOK, conns)
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var conn Connection
	if err := json.NewDecoder(r.Body).Decode(&conn); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.Create(&conn); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, conn)
}

func (h *Handler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	conn, err := h.svc.Get(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if conn == nil {
		httputil.WriteError(w, http.StatusNotFound, "connection not found")
		return
	}
	// Omit password in API response
	conn.Password = ""
	httputil.WriteJSON(w, http.StatusOK, conn)
}

func (h *Handler) handleUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var conn Connection
	if err := json.NewDecoder(r.Body).Decode(&conn); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	conn.ID = id

	if err := h.svc.Update(&conn); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, conn)
}

func (h *Handler) handleDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(id); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleTest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Allow testing without saving — accept connection details in body
	if id == "_new" || id == "" {
		var conn Connection
		if err := json.NewDecoder(r.Body).Decode(&conn); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		err := TestConnection(&conn)
		if err != nil {
			httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
			return
		}
		httputil.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
		return
	}

	conn, err := h.svc.Get(id)
	if err != nil || conn == nil {
		httputil.WriteError(w, http.StatusNotFound, "connection not found")
		return
	}

	if err := TestConnection(conn); err != nil {
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) handleListDatabases(w http.ResponseWriter, r *http.Request) {
	connectionID := r.PathValue("id")
	dbs, err := h.svc.ListDatabases(connectionID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, dbs)
}

func (h *Handler) handleDiscover(w http.ResponseWriter, r *http.Request) {
	connectionID := r.PathValue("id")
	dbs, err := h.svc.Discover(connectionID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, dbs)
}

func (h *Handler) handleUpdateDatabase(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		IsSelected bool `json:"is_selected"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.UpdateDatabaseSelection(id, req.IsSelected); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
