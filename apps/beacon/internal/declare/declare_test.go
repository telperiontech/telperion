package declare

import (
	"context"
	"errors"
	"io/fs"
	"strings"
	"testing"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

const example = `
github:
  app_id: 123456
  private_key_file: /run/secrets/app.pem

targets:
  coolify-main:
    coolify: { url: https://coolify.example.com, token_env: COOLIFY_TOKEN }

projects:
  - name: telperion
    repo: telperiontech/telperion
    ci: { github-actions: { workflow: "{package}.publish.yml" } }
    packages:
      js-utils: { artifact: { npm: "@telperion/js-utils" } }
      docs: { ci: none }
      frp-gate:
        artifact: { oci: ghcr.io/telperiontech/frp-gate }
        deploy:
          - coolify-main: { app: abc123 }
          - http-check: { url: "https://gate.example.com/healthz", version: { header: X-Version } }

  - name: elsewhere
    repo: { git: https://git.example.com/acme/site.git }
    tag: "v{version}"
    packages:
      site:
        deploy:
          - http-check: { url: "https://docs.example.com/version.json", version: { json: /version } }
`

func testEnv() Env {
	return Env{
		Getenv: func(k string) string { return map[string]string{"COOLIFY_TOKEN": "t"}[k] },
		ReadFile: func(p string) ([]byte, error) {
			if p == "/run/secrets/app.pem" {
				return []byte("-----BEGIN RSA PRIVATE KEY-----"), nil
			}
			return nil, fs.ErrNotExist
		},
	}
}

func mustResolve(t *testing.T, src string) *File {
	t.Helper()
	f, err := Parse([]byte(src))
	if err != nil {
		t.Fatal(err)
	}
	return f
}

func TestResolveExample(t *testing.T) {
	c, err := mustResolve(t, example).Resolve(testEnv())
	if err != nil {
		t.Fatal(err)
	}
	js, _ := c.Package("js-utils")
	if js.Tag != "{package}-v{version}" || js.CI.GitHubActions.Workflow != "js-utils.publish.yml" ||
		js.Artifact.NPM.Registry != DefaultNPMRegistry || js.Repo.URL != "https://github.com/telperiontech/telperion.git" {
		t.Errorf("js-utils = %+v", js)
	}
	if chain := js.Chain(); len(chain) != 3 || chain[2] != model.Published {
		t.Errorf("js-utils chain = %v", chain)
	}
	if docs, _ := c.Package("docs"); docs.CI != nil {
		t.Error("ci: none did not turn the project default off")
	}
	gate, _ := c.Package("frp-gate")
	if gate.Artifact.OCI.Registry != "ghcr.io" || gate.Artifact.OCI.Name != "telperiontech/frp-gate" ||
		len(gate.Deploy) != 2 || gate.Deploy[1].Target != "gate.example.com" {
		t.Errorf("frp-gate = %+v", gate)
	}
	site, _ := c.Package("site")
	if chain := site.Chain(); len(chain) != 2 || chain[1] != model.Deployed || site.Tag != "v{version}" {
		t.Errorf("site = %+v chain %v", site, chain)
	}
}

func TestResolveErrors(t *testing.T) {
	cases := map[string]string{
		"unknown key":    `projects: [{name: a, repo: o/r, packages: {a: {artifakt: {}}}}]`,
		"unknown target": `projects: [{name: a, repo: o/r, packages: {a: {deploy: [{nowhere: {app: x}}]}}}]`,
		"missing secret": `targets: {t: {coolify: {url: "https://c.example.com", token_env: UNSET}}}
projects: [{name: a, repo: o/r, packages: {a: {}}}]`,
		"tag clash":         `projects: [{name: a, repo: o/r, tag: "{version}", packages: {x: {}, y: {}}}]`,
		"duplicate package": `projects: [{name: a, repo: o/r, packages: {x: {}}}, {name: b, repo: o/s, packages: {x: {}}}]`,
		"image with tag":    `projects: [{name: a, repo: o/r, packages: {x: {artifact: {oci: ghcr.io/o/x:1.0}}}}]`,
		"bad name":          `projects: [{name: A, repo: o/r, packages: {x: {}}}]`,
		"ci on git repo":    `projects: [{name: a, repo: {git: "https://git.example.com/x.git"}, ci: {github-actions: {workflow: w.yml}}, packages: {x: {}}}]`,
	}
	for name, src := range cases {
		t.Run(name, func(t *testing.T) {
			f, err := Parse([]byte(src))
			if err == nil {
				_, err = f.Resolve(testEnv())
			}
			if err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

func TestApplyExportRoundTrip(t *testing.T) {
	ctx := context.Background()
	st, err := store.Open(ctx, ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	c, err := mustResolve(t, example).Resolve(testEnv())
	if err != nil {
		t.Fatal(err)
	}

	dry, err := Apply(ctx, st, c, true)
	if err != nil || len(dry.Changes) == 0 {
		t.Fatalf("dry run = %+v %v", dry, err)
	}
	if cur, _ := st.LoadCatalog(ctx); len(cur.Packages) != 0 {
		t.Fatal("a dry run changed the store")
	}

	res, err := Apply(ctx, st, c, false)
	if err != nil {
		t.Fatal(err)
	}
	if got := len(res.Changes); got != 1+1+2+4 { // github, target, 2 projects, 4 packages
		t.Errorf("changes = %v", res.Changes)
	}
	if again, _ := Apply(ctx, st, c, false); len(again.Changes) != 0 {
		t.Errorf("a second apply changed %v", again.Changes)
	}

	stored, _ := st.LoadCatalog(ctx)
	out, err := Export(stored)
	if err != nil {
		t.Fatal(err)
	}
	back, err := mustResolve(t, string(out)).Resolve(testEnv())
	if err != nil {
		t.Fatalf("exported file is invalid: %v\n%s", err, out)
	}
	if d := Diff(stored, back); len(d) != 0 {
		t.Errorf("export | apply changes %v\n%s", d, out)
	}
	if !strings.Contains(string(out), "repo: telperiontech/telperion") || strings.Contains(string(out), "registry.npmjs.org") {
		t.Errorf("export does not use the short forms:\n%s", out)
	}
}

func TestApplyRemovesObservations(t *testing.T) {
	ctx := context.Background()
	st, _ := store.Open(ctx, ":memory:")
	defer st.Close()
	c, _ := mustResolve(t, example).Resolve(testEnv())
	if _, err := Apply(ctx, st, c, false); err != nil {
		t.Fatal(err)
	}
	if _, err := st.Observe(ctx, []model.Obs{{Package: "docs", Version: "1.0.0", Stage: model.Tagged, State: model.OK}}); err != nil {
		t.Fatal(err)
	}
	c.Packages = c.Packages[1:] // drop "docs" (sorted first)
	if _, err := Apply(ctx, st, c, false); err != nil {
		t.Fatal(err)
	}
	states, _ := st.States(ctx, "docs")
	if len(states) != 0 {
		t.Errorf("observations of a removed package survived: %+v", states)
	}
	if _, err := Parse([]byte("")); err == nil || errors.Is(err, nil) {
		t.Error("an empty file parsed")
	}
}
