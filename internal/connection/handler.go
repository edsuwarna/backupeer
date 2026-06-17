package connection

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/edsuwarna/jagad/internal/httputil"
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
	mux.HandleFunc("GET /api/connections/{id}/health", h.handleHealth)
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

// handleHealth returns a detailed live health check for a connection.
func (h *Handler) handleHealth(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	conn, err := h.svc.Get(id)
	if err != nil || conn == nil {
		httputil.WriteError(w, http.StatusNotFound, "connection not found")
		return
	}

	// Use the monitoring-style health check logic
	now := time.Now()
	result := map[string]interface{}{
		"connection_id": conn.ID,
		"name":          conn.Name,
		"db_type":       conn.DBType,
		"host":          conn.Host,
		"port":          conn.Port,
		"time":          now.Format(time.RFC3339),
	}

	sourceDB, err := openSourceDB(conn)
	if err != nil {
		result["status"] = "down"
		result["error"] = err.Error()
		httputil.WriteJSON(w, http.StatusOK, result)
		return
	}
	defer sourceDB.Close()

	pingStart := time.Now()
	err = sourceDB.Ping()
	responseTimeMs := time.Since(pingStart).Milliseconds()
	result["response_time_ms"] = responseTimeMs

	if err != nil {
		result["status"] = "down"
		result["error"] = err.Error()
		httputil.WriteJSON(w, http.StatusOK, result)
		return
	}

	// Get active connections
	activeConns := queryActiveConns(sourceDB, conn.DBType)
	result["active_connections"] = activeConns

	// Determine status
	if responseTimeMs < 1000 {
		result["status"] = "healthy"
	} else if responseTimeMs < 5000 {
		result["status"] = "degraded"
	} else {
		result["status"] = "down"
		result["error"] = fmt.Sprintf("high response time: %dms", responseTimeMs)
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

// openSourceDB opens a connection to a source database for monitoring/health checks.
func openSourceDB(conn *Connection) (*sql.DB, error) {
	switch conn.DBType {
	case "postgresql":
		dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=%s connect_timeout=5",
			conn.Host, conn.Port, conn.Username, conn.Password, conn.SSLMode)
		return sql.Open("pgx", dsn)
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?tls=%s&timeout=5s&charset=utf8mb4",
			conn.Username, conn.Password, conn.Host, conn.Port, conn.SSLMode)
		return sql.Open("mysql", dsn)
	case "mariadb":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?tls=%s&timeout=5s&charset=utf8mb4&multiStatements=true",
			conn.Username, conn.Password, conn.Host, conn.Port, conn.SSLMode)
		return sql.Open("mysql", dsn)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", conn.DBType)
	}
}

// queryActiveConns returns the number of active connections for a source DB.
func queryActiveConns(db *sql.DB, dbType string) int {
	switch dbType {
	case "postgresql":
		var count int
		err := db.QueryRow(`SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`).Scan(&count)
		if err != nil {
			return 0
		}
		return count
	case "mysql", "mariadb":
		var count int
		err := db.QueryRow(`SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME = 'Threads_connected'`).Scan(&count)
		if err != nil {
			_ = db.QueryRow(`SELECT COUNT(*) FROM information_schema.processlist`).Scan(&count)
		}
		return count
	default:
		return 0
	}
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
