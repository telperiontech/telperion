package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

func find(name string) (fakePkg, bool) {
	for _, p := range catalog() {
		if p.name == name {
			return p, true
		}
	}
	return fakePkg{}, false
}

func pkt(s string) string { return fmt.Sprintf("%04x%s", len(s)+4, s) }

func sha(p fakePkg, k int) string { return fmt.Sprintf("%040x", len(p.name)*1000+k) }

// routeGit: the ref advertisement of both repos.
func routeGit(mux *http.ServeMux, w world) {
	advertise := func(rw http.ResponseWriter, sites bool) {
		var b strings.Builder
		b.WriteString(pkt("# service=git-upload-pack\n") + "0000")
		b.WriteString(pkt(strings.Repeat("a", 40) + " HEAD\x00multi_ack symref=HEAD:refs/heads/main\n"))
		b.WriteString(pkt(strings.Repeat("a", 40) + " refs/heads/main\n"))
		for _, p := range catalog() {
			if (p.kind == site) != sites {
				continue
			}
			for _, k := range w.versions(p) {
				b.WriteString(pkt(sha(p, k) + " refs/tags/" + p.name + "-v" + version(k) + "\n"))
			}
		}
		b.WriteString("0000")
		rw.Header().Set("Content-Type", "application/x-git-upload-pack-advertisement")
		_, _ = rw.Write([]byte(b.String()))
	}
	mux.HandleFunc("GET /telperiontech/telperion.git/info/refs", func(rw http.ResponseWriter, _ *http.Request) { advertise(rw, false) })
	mux.HandleFunc("GET /git/acme/sites.git/info/refs", func(rw http.ResponseWriter, _ *http.Request) { advertise(rw, true) })
}

// routeGitHub: App installation tokens and workflow runs, with rate-limit headers.
func routeGitHub(mux *http.ServeMux, w world) {
	var used atomic.Int64
	limit := func(rw http.ResponseWriter) {
		rw.Header().Set("X-RateLimit-Limit", "5000")
		rw.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(max(0, 5000-used.Add(1)), 10))
		rw.Header().Set("X-RateLimit-Reset", strconv.FormatInt(w.now().Add(time.Hour).Unix(), 10))
	}
	mux.HandleFunc("GET /api/repos/{owner}/{repo}/installation", func(rw http.ResponseWriter, r *http.Request) {
		writeJSON(rw, r, map[string]int{"id": 1})
	})
	mux.HandleFunc("POST /api/app/installations/1/access_tokens", func(rw http.ResponseWriter, r *http.Request) {
		writeJSON(rw, r, map[string]any{"token": "ghs_fake", "expires_at": w.now().Add(time.Hour)})
	})
	mux.HandleFunc("GET /api/repos/{owner}/{repo}/actions/workflows/{workflow}/runs", func(rw http.ResponseWriter, r *http.Request) {
		limit(rw)
		p, ok := find(strings.TrimSuffix(r.PathValue("workflow"), ".publish.yml"))
		if !ok {
			http.NotFound(rw, r)
			return
		}
		var runs []map[string]any
		vs := w.versions(p)
		for i := len(vs) - 1; i >= 0 && len(runs) < 100; i-- {
			k := vs[i]
			age := w.age(p, k)
			if age < runStarts {
				continue
			}
			run := map[string]any{
				"id": len(p.name)*100000 + k, "head_branch": p.name + "-v" + version(k), "status": "in_progress",
				"html_url":   fmt.Sprintf("https://ci.example.com/%s/%d", p.name, k),
				"created_at": w.tagTime(p, k).Add(runStarts), "updated_at": w.tagTime(p, k).Add(min(age, runEnds)),
			}
			if age >= runEnds {
				run["status"], run["conclusion"] = "completed", "success"
				if failed(k) {
					run["conclusion"] = "failure"
				}
			}
			runs = append(runs, run)
		}
		writeJSON(rw, r, map[string]any{"total_count": len(runs), "workflow_runs": runs})
	})
}

// routeRuntime: Coolify applications and http-check endpoints.
func routeRuntime(mux *http.ServeMux, w world) {
	mux.HandleFunc("GET /coolify/api/v1/applications/{uuid}", func(rw http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer fake-coolify-token" {
			http.Error(rw, "unauthenticated", http.StatusUnauthorized)
			return
		}
		p, ok := find(r.PathValue("uuid"))
		k, running := w.running(p)
		if !ok || !running {
			writeJSON(rw, r, map[string]string{"status": "exited", "docker_registry_image_tag": ""})
			return
		}
		writeJSON(rw, r, map[string]string{"status": "running:healthy", "docker_registry_image_tag": version(k)})
	})
	mux.HandleFunc("GET /run/{name}/version.json", func(rw http.ResponseWriter, r *http.Request) {
		p, _ := find(r.PathValue("name"))
		if k, ok := w.running(p); ok {
			writeJSON(rw, r, map[string]any{"version": version(k), "build": map[string]string{"commit": sha(p, k)}})
			return
		}
		http.Error(rw, "starting", http.StatusServiceUnavailable)
	})
	mux.HandleFunc("GET /run/{name}/version", func(rw http.ResponseWriter, r *http.Request) {
		p, _ := find(r.PathValue("name"))
		if k, ok := w.running(p); ok {
			rw.Header().Set("X-Version", "v"+version(k))
			_, _ = rw.Write([]byte("ok\n"))
			return
		}
		http.Error(rw, "starting", http.StatusServiceUnavailable)
	})
}
