// Package web serves the Angular UI, built into dist/ and embedded in the binary.
package web

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"path"
	"regexp"
	"strings"
)

// dist is the built UI (ui/ → nx build beacon-ui). The Dockerfile copies it in
// before compiling; locally, build beacon-ui first.
//
//go:embed all:dist
var dist embed.FS

// hashed matches Angular's content-hashed output names (main-ABCD1234.js), which
// never change content and may be cached forever.
var hashed = regexp.MustCompile(`-[A-Z0-9]{8}\.(js|css)$`)

// Handler serves the embedded UI.
func Handler() http.Handler {
	files, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err) // "dist" is a literal embedded directory
	}
	return handler(files)
}

// handler serves files from root. Any other path without a file extension is a
// client-side route and gets index.html (directories are never listed); a
// missing asset is a 404.
func handler(root fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		info, err := fs.Stat(root, name)
		switch {
		case name != "" && err == nil && !info.IsDir():
			w.Header().Set("Cache-Control", cacheControl(name))
			http.ServeFileFS(w, r, root, name)
		case path.Ext(name) != "":
			http.NotFound(w, r)
		default:
			w.Header().Set("Cache-Control", "no-cache")
			serveIndex(w, r, root)
		}
	})
}

// serveIndex writes index.html without http.ServeFileFS's redirect of
// ".../index.html" requests, so every client route answers 200 in place.
func serveIndex(w http.ResponseWriter, r *http.Request, root fs.FS) {
	f, err := root.Open("index.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		http.Error(w, "index.html unreadable", http.StatusInternalServerError)
		return
	}
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		http.Error(w, "index.html not seekable", http.StatusInternalServerError)
		return
	}
	http.ServeContent(w, r, "index.html", info.ModTime(), rs)
}

// cacheControl lets browsers keep content-hashed files forever and makes them
// revalidate everything else (index.html, favicon).
func cacheControl(name string) string {
	if hashed.MatchString(name) {
		return "public, max-age=31536000, immutable"
	}
	return "no-cache"
}
