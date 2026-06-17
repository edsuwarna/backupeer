package schedule

import (
	"encoding/json"
	"net/http"

	"github.com/edsuwarna/jagad/internal/httputil"
)

type Handler struct {
	svc       *Service
	scheduler *Scheduler
}

func NewHandler(svc *Service, scheduler *Scheduler) *Handler {
	return &Handler{svc: svc, scheduler: scheduler}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/schedules", h.handleList)
	mux.HandleFunc("POST /api/schedules", h.handleCreate)
	mux.HandleFunc("GET /api/schedules/{id}", h.handleGet)
	mux.HandleFunc("PUT /api/schedules/{id}", h.handleUpdate)
	mux.HandleFunc("DELETE /api/schedules/{id}", h.handleDelete)
	mux.HandleFunc("POST /api/schedules/{id}/run", h.handleRun)
}

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request) {
	connectionID := r.URL.Query().Get("connection_id")
	var schedules []Schedule
	var err error
	if connectionID != "" {
		schedules, err = h.svc.ListByConnection(connectionID)
	} else {
		schedules, err = h.svc.List()
	}
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if schedules == nil {
		schedules = []Schedule{}
	}
	httputil.WriteJSON(w, http.StatusOK, schedules)
}

func (h *Handler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var sch Schedule
	if err := json.NewDecoder(r.Body).Decode(&sch); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.Create(&sch); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Register with scheduler
	if err := h.scheduler.AddJob(&sch); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "schedule created but cron registration failed: "+err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, sch)
}

func (h *Handler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sch, err := h.svc.Get(id)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if sch == nil {
		httputil.WriteError(w, http.StatusNotFound, "schedule not found")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, sch)
}

func (h *Handler) handleUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var sch Schedule
	if err := json.NewDecoder(r.Body).Decode(&sch); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	sch.ID = id
	if err := h.svc.Update(&sch); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Re-register with scheduler
	if err := h.scheduler.AddJob(&sch); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "schedule updated but cron registration failed: "+err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, sch)
}

func (h *Handler) handleDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// Remove from scheduler first
	h.scheduler.RemoveJob(id)
	if err := h.svc.Delete(id); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleRun(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.scheduler.RunNow(id); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "triggered", "schedule_id": id})
}
