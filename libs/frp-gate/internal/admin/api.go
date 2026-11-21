package admin

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// apiRoutes is the JSON API under /api/v1. Objects are addressed by name.
func (s *Server) apiRoutes() http.Handler {
	m := http.NewServeMux()
	const p = "/api/v1/"
	m.HandleFunc("GET "+p+"status", s.apiStatus)

	m.HandleFunc("GET "+p+"clients", s.apiClients)
	m.HandleFunc("POST "+p+"clients", s.apiClientCreate)
	m.HandleFunc("GET "+p+"clients/{name}", s.apiClient)
	m.HandleFunc("POST "+p+"clients/{name}/{action}", s.apiClientAction)
	m.HandleFunc("DELETE "+p+"clients/{name}", s.apiClientDelete)

	m.HandleFunc("GET "+p+"zones", s.apiZones)
	m.HandleFunc("POST "+p+"zones", s.apiZoneCreate)
	m.HandleFunc("DELETE "+p+"zones/{domain}", s.apiZoneDelete)

	m.HandleFunc("GET "+p+"instances", s.apiInstances)
	m.HandleFunc("POST "+p+"instances", s.apiInstanceCreate)
	m.HandleFunc("PUT "+p+"instances/{name}/zones", s.apiInstanceZones)
	m.HandleFunc("POST "+p+"instances/{name}/rotate", s.apiInstanceRotate)
	m.HandleFunc("DELETE "+p+"instances/{name}", s.apiInstanceDelete)

	m.HandleFunc("GET "+p+"groups", s.apiGroups)
	m.HandleFunc("POST "+p+"groups", s.apiGroupCreate)
	m.HandleFunc("DELETE "+p+"groups/{name}", s.apiGroupDelete)
	m.HandleFunc("PUT "+p+"groups/{name}/members/{client}", s.apiMember(true))
	m.HandleFunc("DELETE "+p+"groups/{name}/members/{client}", s.apiMember(false))

	m.HandleFunc("GET "+p+"grants", s.apiGrants)
	m.HandleFunc("POST "+p+"grants", s.apiGrantCreate)
	m.HandleFunc("DELETE "+p+"grants/{id}", s.apiGrantDelete)

	m.HandleFunc(p, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no such endpoint"})
	})
	return m
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func readJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return badInput("invalid JSON body: %v", err)
	}
	return nil
}

// apiResult writes v, or the error with a fitting status code.
func (s *Server) apiResult(w http.ResponseWriter, code int, v any, err error) {
	if err == nil {
		if v == nil {
			v = map[string]bool{"ok": true}
		}
		writeJSON(w, code, v)
		return
	}
	var in inputError
	status := http.StatusInternalServerError
	switch {
	case errors.As(err, &in):
		status = http.StatusBadRequest
	case errors.Is(err, store.ErrNotFound):
		status = http.StatusNotFound
	case errors.Is(err, store.ErrConflict), errors.Is(err, store.ErrInUse):
		status = http.StatusConflict
	}
	writeJSON(w, status, map[string]string{"error": s.userMessage(err)})
}
