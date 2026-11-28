package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// writes answers the GitHub writes of plans (releases, file commits,
// branches, pull requests) from memory, so a plan can be started against the
// fake platform. A created tag does not appear in the fake repo (its versions
// follow the timeline), so a release step ends at its tag timeout; a pull
// request merges itself after prMerge.
type writes struct {
	mu       sync.Mutex
	files    map[string]string // branch + "\x00" + path → content
	branches map[string]bool
	pulls    []fakePull
	commits  int
}

type fakePull struct {
	Number  int    `json:"number"`
	HTMLURL string `json:"html_url"`
	State   string `json:"state"`
	Merged  bool   `json:"merged"`
	Merge   string `json:"merge_commit_sha,omitempty"`
	head    string
	opened  time.Time
}

const prMerge = time.Minute

func routeWrites(mux *http.ServeMux, base string) {
	ws := &writes{files: map[string]string{}, branches: map[string]bool{}}
	const repo = "/api/repos/{owner}/{repo}"
	mux.HandleFunc("POST "+repo+"/releases", func(rw http.ResponseWriter, r *http.Request) {
		var body struct {
			Tag string `json:"tag_name"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		writeJSON(rw, r, map[string]string{"html_url": base + "/releases/" + body.Tag})
	})
	mux.HandleFunc("GET "+repo+"/git/ref/{ref...}", func(rw http.ResponseWriter, r *http.Request) {
		ws.mu.Lock()
		defer ws.mu.Unlock()
		if !ws.branches[strings.TrimPrefix(r.PathValue("ref"), "heads/")] {
			http.NotFound(rw, r)
			return
		}
		writeJSON(rw, r, map[string]string{})
	})
	mux.HandleFunc("POST "+repo+"/git/refs", func(rw http.ResponseWriter, r *http.Request) {
		var body struct {
			Ref string `json:"ref"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		ws.mu.Lock()
		ws.branches[strings.TrimPrefix(body.Ref, "refs/heads/")] = true
		ws.mu.Unlock()
		writeJSON(rw, r, map[string]string{})
	})
	mux.HandleFunc("GET "+repo+"/contents/{path...}", func(rw http.ResponseWriter, r *http.Request) {
		content := ws.file(r.URL.Query().Get("ref"), r.PathValue("path"))
		writeJSON(rw, r, map[string]string{
			"encoding": "base64", "sha": blob(content), "content": base64.StdEncoding.EncodeToString([]byte(content)),
		})
	})
	mux.HandleFunc("PUT "+repo+"/contents/{path...}", func(rw http.ResponseWriter, r *http.Request) {
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		b, _ := base64.StdEncoding.DecodeString(body["content"])
		ws.mu.Lock()
		defer ws.mu.Unlock()
		ws.files[body["branch"]+"\x00"+r.PathValue("path")] = string(b)
		ws.commits++
		sha := fmt.Sprintf("%040x", 0xc0ffee000+ws.commits)
		writeJSON(rw, r, map[string]any{"commit": map[string]string{"sha": sha, "html_url": base + "/commit/" + sha}})
	})
	mux.HandleFunc("GET "+repo+"/pulls", func(rw http.ResponseWriter, r *http.Request) {
		head := r.URL.Query().Get("head")
		_, head, _ = strings.Cut(head, ":")
		ws.mu.Lock()
		defer ws.mu.Unlock()
		out := []fakePull{}
		for _, p := range ws.pulls {
			if p.head == head {
				out = append(out, ws.state(p))
			}
		}
		writeJSON(rw, r, out)
	})
	mux.HandleFunc("POST "+repo+"/pulls", func(rw http.ResponseWriter, r *http.Request) {
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		ws.mu.Lock()
		defer ws.mu.Unlock()
		n := len(ws.pulls) + 1
		p := fakePull{Number: n, HTMLURL: base + "/pull/" + strconv.Itoa(n), State: "open", head: body["head"], opened: time.Now()}
		ws.pulls = append(ws.pulls, p)
		writeJSON(rw, r, p)
	})
	mux.HandleFunc("GET "+repo+"/pulls/{n}", func(rw http.ResponseWriter, r *http.Request) {
		n, _ := strconv.Atoi(r.PathValue("n"))
		ws.mu.Lock()
		defer ws.mu.Unlock()
		if n < 1 || n > len(ws.pulls) {
			http.NotFound(rw, r)
			return
		}
		writeJSON(rw, r, ws.state(ws.pulls[n-1]))
	})
}

// file is a file on a branch: what was committed, else a package.json that
// depends on lib-01.
func (ws *writes) file(branch, path string) string {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	if c, ok := ws.files[branch+"\x00"+path]; ok {
		return c
	}
	if c, ok := ws.files["main\x00"+path]; ok && branch != "main" {
		return c
	}
	name := strings.TrimSuffix(strings.TrimPrefix(path, "libs/"), "/package.json")
	return fmt.Sprintf("{\n  \"name\": \"@telperion/%s\",\n  \"peerDependencies\": {\n    \"@telperion/lib-01\": \"^1.0.0\"\n  }\n}\n", name)
}

func (ws *writes) state(p fakePull) fakePull {
	if time.Since(p.opened) > prMerge {
		p.State, p.Merged, p.Merge = "closed", true, fmt.Sprintf("%040x", 0xbeef000+p.Number)
	}
	return p
}

func blob(content string) string { return fmt.Sprintf("blob-%d", len(content)) }

// routeCoolifyDeploys accepts deploys: the tag is set, a deployment starts
// and finishes after a few seconds. What runs still follows the timeline.
func routeCoolifyDeploys(mux *http.ServeMux) {
	started := time.Now()
	mux.HandleFunc("PATCH /coolify/api/v1/applications/{uuid}", func(rw http.ResponseWriter, r *http.Request) {
		writeJSON(rw, r, map[string]string{"uuid": r.PathValue("uuid")})
	})
	mux.HandleFunc("GET /coolify/api/v1/deploy", func(rw http.ResponseWriter, r *http.Request) {
		writeJSON(rw, r, map[string]any{"deployments": []map[string]string{{"deployment_uuid": "dep-" + r.URL.Query().Get("uuid")}}})
	})
	mux.HandleFunc("GET /coolify/api/v1/deployments/{id}", func(rw http.ResponseWriter, r *http.Request) {
		status := "in_progress"
		if time.Since(started) > 20*time.Second {
			status = "finished"
		}
		writeJSON(rw, r, map[string]string{"status": status})
	})
}
