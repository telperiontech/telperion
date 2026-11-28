package main

import (
	"net/http"
	"strings"
	"time"
)

// routeNPM: packuments. lib-01's is several MB (long manifests and readme),
// which Beacon must stream instead of loading.
func routeNPM(mux *http.ServeMux, w world) {
	mux.HandleFunc("GET /npm/{name...}", func(rw http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(strings.ReplaceAll(r.PathValue("name"), "%2F", "/"), "@telperion/")
		p, ok := find(name)
		if !ok || p.kind != npmLib {
			http.NotFound(rw, r)
			return
		}
		versions, times := map[string]any{}, map[string]string{"created": w.tagTime(p, 0).Format(time.RFC3339)}
		filler := ""
		if p.bigDocs {
			filler = strings.Repeat("Lorem ipsum dolor sit amet. ", 400) // ~11 KB per version
		}
		for _, k := range w.versions(p) {
			if !w.published(p, k) {
				continue
			}
			versions[version(k)] = map[string]any{
				"name": "@telperion/" + name, "version": version(k), "description": filler,
				"dependencies": map[string]string{"tslib": "^2.3.0"},
				"dist":         map[string]any{"tarball": "https://npm.example.com/x.tgz", "integrity": "sha512-x"},
			}
			times[version(k)] = w.tagTime(p, k).Add(publishedAt).Format(time.RFC3339)
		}
		writeJSON(rw, r, map[string]any{
			"_id": "@telperion/" + name, "name": "@telperion/" + name, "versions": versions, "time": times,
			"readme": strings.Repeat(filler, 20),
		})
	})
}

// routeOCI: tag lists (paginated by 10) and image indexes; no auth.
func routeOCI(mux *http.ServeMux, w world) {
	mux.HandleFunc("GET /v2/telperiontech/{name}/tags/list", func(rw http.ResponseWriter, r *http.Request) {
		p, ok := find(r.PathValue("name"))
		if !ok || p.kind != image {
			http.NotFound(rw, r)
			return
		}
		tags := []string{"latest"}
		for _, k := range w.versions(p) {
			if w.published(p, k) {
				tags = append(tags, version(k))
			}
		}
		last := r.URL.Query().Get("last")
		start := 0
		for i, t := range tags {
			if t == last {
				start = i + 1
			}
		}
		end := min(start+10, len(tags))
		if end < len(tags) {
			rw.Header().Set("Link", `</v2/telperiontech/`+p.name+`/tags/list?n=10&last=`+tags[end-1]+`>; rel="next"`)
		}
		writeJSON(rw, r, map[string]any{"name": "telperiontech/" + p.name, "tags": tags[start:end]})
	})
	mux.HandleFunc("GET /v2/telperiontech/{name}/manifests/{tag}", func(rw http.ResponseWriter, r *http.Request) {
		p, _ := find(r.PathValue("name"))
		platforms := []map[string]any{
			{"platform": map[string]string{"os": "linux", "architecture": "amd64"}},
			{"platform": map[string]string{"os": "unknown", "architecture": "unknown"}},
		}
		if !p.amd64 {
			platforms = append(platforms, map[string]any{"platform": map[string]string{"os": "linux", "architecture": "arm64"}})
		}
		rw.Header().Set("Content-Type", "application/vnd.oci.image.index.v1+json")
		writeJSON(rw, r, map[string]any{"schemaVersion": 2, "manifests": platforms})
	})
}
