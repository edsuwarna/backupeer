// Package api provides HTTP routing and server setup.
package api

import (
	"net/http"

	"github.com/edsuwarna/backupeer/internal/backup"
	"github.com/edsuwarna/backupeer/internal/connection"
	"github.com/edsuwarna/backupeer/internal/restore"
	"github.com/edsuwarna/backupeer/internal/schedule"
	"github.com/edsuwarna/backupeer/internal/storage"
)

// Router composes all domain routes into a single http.Handler.
type Router struct {
	mux *http.ServeMux
}

func NewRouter(
	connHandler *connection.Handler,
	backupHandler *backup.Handler,
	scheduleHandler *schedule.Handler,
	restoreHandler *restore.Handler,
	storageProvHandler *storage.ProviderHandler,
) *Router {
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// Register domain routes
	connHandler.RegisterRoutes(mux)
	backupHandler.RegisterRoutes(mux)
	scheduleHandler.RegisterRoutes(mux)
	restoreHandler.RegisterRoutes(mux)
	storageProvHandler.RegisterRoutes(mux)

	// Static files (Web UI)
	mux.Handle("/", http.FileServer(http.Dir("./web")))

	return &Router{mux: mux}
}

func (r *Router) Handler() http.Handler {
	return r.mux
}
