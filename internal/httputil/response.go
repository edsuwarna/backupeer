// Package httputil provides shared HTTP utilities (JSON response helpers, middleware).
package httputil

import (
	"encoding/json"
	"net/http"
)

// WriteJSON sends a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(data)
}

// WriteError sends a JSON error response.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{"error": message})
}

// DecodeJSON decodes a JSON request body into the given value.
func DecodeJSON(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
