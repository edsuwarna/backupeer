package monitoring

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

// Handler serves monitoring API endpoints.
type Handler struct {
	store     Store
	collector *Collector
}

func NewHandler(store Store) *Handler {
	return &Handler{store: store}
}

// SetCollector attaches the collector for manual trigger endpoints.
func (h *Handler) SetCollector(c *Collector) {
	h.collector = c
}

// RegisterRoutes adds monitoring routes to the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/monitoring/health", h.ListHealthChecks)
	mux.HandleFunc("GET /api/monitoring/metrics", h.ListDBMetrics)
	mux.HandleFunc("GET /api/monitoring/performance", h.ListPerformanceMetrics)
	mux.HandleFunc("POST /api/monitoring/collect", h.TriggerCollect)
}

func (h *Handler) ListHealthChecks(w http.ResponseWriter, r *http.Request) {
	connectionID := r.URL.Query().Get("connection_id")
	since := parseTime(r.URL.Query().Get("since"))
	until := parseTime(r.URL.Query().Get("until"))
	limit := parseLimit(r.URL.Query().Get("limit"), 50)

	results, err := h.store.QueryHealthChecks(connectionID, since, until, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query health checks: "+err.Error())
		return
	}
	if results == nil {
		results = []HealthCheck{}
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *Handler) ListDBMetrics(w http.ResponseWriter, r *http.Request) {
	connectionID := r.URL.Query().Get("connection_id")
	since := parseTime(r.URL.Query().Get("since"))
	until := parseTime(r.URL.Query().Get("until"))
	limit := parseLimit(r.URL.Query().Get("limit"), 50)

	results, err := h.store.QueryDBMetrics(connectionID, since, until, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query db metrics: "+err.Error())
		return
	}
	if results == nil {
		results = []DBMetric{}
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *Handler) ListPerformanceMetrics(w http.ResponseWriter, r *http.Request) {
	connectionID := r.URL.Query().Get("connection_id")
	since := parseTime(r.URL.Query().Get("since"))
	until := parseTime(r.URL.Query().Get("until"))
	limit := parseLimit(r.URL.Query().Get("limit"), 50)

	results, err := h.store.QueryPerformanceMetrics(connectionID, since, until, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "query performance: "+err.Error())
		return
	}
	if results == nil {
		results = []PerformanceMetric{}
	}
	writeJSON(w, http.StatusOK, results)
}

// TriggerCollect manually triggers a collection cycle.
func (h *Handler) TriggerCollect(w http.ResponseWriter, r *http.Request) {
	if h.collector == nil {
		writeError(w, http.StatusServiceUnavailable, "collector not initialized")
		return
	}

	go func() {
		if err := h.collector.CollectNow(r.Context()); err != nil {
			// Log only — collector errors are handled internally
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "collection started"})
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func parseLimit(s string, defaultLimit int) int {
	if s == "" {
		return defaultLimit
	}
	v, err := strconv.Atoi(s)
	if err != nil || v <= 0 {
		return defaultLimit
	}
	if v > 200 {
		return 200
	}
	return v
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
