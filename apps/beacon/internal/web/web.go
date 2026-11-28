// Package web serves the Angular UI, built into dist/ and embedded in the binary.
package web

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/telperiontech/telperion/libs/go-kit/spa"
)

// dist is the built UI (ui/ → nx build beacon-ui). The Dockerfile copies it in
// before compiling; locally, build beacon-ui first.
//
//go:embed all:dist
var dist embed.FS

// Handler serves the embedded UI.
func Handler() http.Handler {
	files, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err) // "dist" is a literal embedded directory
	}
	return spa.Handler(files)
}
