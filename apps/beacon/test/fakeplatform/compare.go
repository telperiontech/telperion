package main

import (
	"fmt"
	"net/http"
	"strings"
)

// routeCompare: unreleased changes. Each package is a few commits ahead of
// its latest tag; libraries (which have a path) see some of them.
func routeCompare(mux *http.ServeMux) {
	commits := func(n int) []map[string]string {
		out := make([]map[string]string, 0, n)
		for i := range n {
			out = append(out, map[string]string{"sha": fmt.Sprintf("%040x", 0xc0de00+i)})
		}
		return out
	}
	mux.HandleFunc("GET /api/repos/{owner}/{repo}/compare/{basehead}", func(rw http.ResponseWriter, r *http.Request) {
		base, _, _ := strings.Cut(r.PathValue("basehead"), "...")
		n := len(base) % 5
		writeJSON(rw, r, map[string]any{"ahead_by": n, "commits": commits(n)})
	})
	mux.HandleFunc("GET /api/repos/{owner}/{repo}/commits", func(rw http.ResponseWriter, r *http.Request) {
		writeJSON(rw, r, commits(len(r.URL.Query().Get("path"))%3))
	})
}
