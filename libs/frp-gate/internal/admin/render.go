package admin

import (
	"embed"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

//go:embed templates/*.html static/*
var assets embed.FS

// pages maps a page name to its template (layout + page).
type pages map[string]*template.Template

var funcs = template.FuncMap{
	"ago": func(t time.Time) string {
		if t.IsZero() {
			return "never"
		}
		d := time.Since(t).Round(time.Second)
		switch {
		case d < time.Minute:
			return fmt.Sprintf("%ds ago", int(d.Seconds()))
		case d < time.Hour:
			return fmt.Sprintf("%dm ago", int(d.Minutes()))
		case d < 48*time.Hour:
			return fmt.Sprintf("%dh ago", int(d.Hours()))
		}
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	},
	"stamp": func(t time.Time) string {
		if t.IsZero() {
			return ""
		}
		return t.UTC().Format("2006-01-02 15:04 UTC")
	},
	"join": strings.Join,
	"has": func(list []int64, id int64) bool {
		for _, v := range list {
			if v == id {
				return true
			}
		}
		return false
	},
}

func loadPages() (pages, error) {
	files, err := assets.ReadDir("templates")
	if err != nil {
		return nil, err
	}
	p := pages{}
	for _, f := range files {
		name := strings.TrimSuffix(f.Name(), ".html")
		if name == "layout" {
			continue
		}
		t, err := template.New("").Funcs(funcs).ParseFS(assets, "templates/layout.html", "templates/"+f.Name())
		if err != nil {
			return nil, err
		}
		p[name] = t
	}
	return p, nil
}

// pageData is what every page template receives.
type pageData struct {
	Title  string
	Active string // nav entry; empty hides the nav (login page)
	OK     string
	Err    string
	W      *world
	Data   map[string]any
	Status int // HTTP status; 0 means 200
}

func (s *Server) render(w http.ResponseWriter, r *http.Request, page string, d pageData) {
	if d.OK == "" {
		d.OK = r.URL.Query().Get("ok")
	}
	if d.Err == "" {
		d.Err = r.URL.Query().Get("err")
	}
	t, ok := s.pages[page]
	if !ok {
		http.Error(w, "unknown page", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if d.Status != 0 {
		w.WriteHeader(d.Status)
	}
	if err := t.ExecuteTemplate(w, "layout", d); err != nil {
		s.log.Error("render failed", "page", page, "err", err)
	}
}

// redirect goes back to a page with a success or error message.
func (s *Server) redirect(w http.ResponseWriter, r *http.Request, path string, err error, ok string) {
	q := url.Values{}
	if err != nil {
		q.Set("err", s.userMessage(err))
	} else if ok != "" {
		q.Set("ok", ok)
	}
	if len(q) > 0 {
		path += "?" + q.Encode()
	}
	http.Redirect(w, r, path, http.StatusSeeOther)
}

// userMessage turns an error into text that is safe to show.
func (s *Server) userMessage(err error) string {
	var in inputError
	switch {
	case errors.As(err, &in):
		return in.msg
	case errors.Is(err, store.ErrNotFound):
		return "Not found."
	case errors.Is(err, store.ErrConflict):
		return "That name is already taken."
	case errors.Is(err, store.ErrInUse):
		return "It is still in use."
	}
	s.log.Error("admin operation failed", "err", err)
	return "Internal error; see the frp-gate log."
}

func (s *Server) loadWorld(w http.ResponseWriter, r *http.Request) (*world, bool) {
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.log.Error("load state failed", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return nil, false
	}
	return wd, true
}
