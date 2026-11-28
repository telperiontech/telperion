package main

import (
	"fmt"
	"strings"
)

// config is the Beacon YAML for the fake catalog: one GitHub-hosted project
// (libs and services) and one plain git project (sites).
func config(base, keyFile string) string {
	host := strings.TrimPrefix(strings.TrimPrefix(base, "http://"), "https://")
	var b strings.Builder
	fmt.Fprintf(&b, `github:
  app_id: 1
  private_key_file: %s
  api_url: %s/api
  web_url: %s

targets:
  coolify-main:
    coolify: { url: %s/coolify, token_env: COOLIFY_TOKEN }

projects:
  - name: telperion
    repo: telperiontech/telperion
    ci: { github-actions: { workflow: "{package}.publish.yml" } }
    packages:
`, keyFile, base, base, base)
	for _, p := range catalog() {
		switch p.kind {
		case npmLib:
			fmt.Fprintf(&b, "      %s: { artifact: { npm: { name: \"@telperion/%s\", registry: %s/npm } } }\n", p.name, p.name, base)
		case image:
			fmt.Fprintf(&b, "      %s:\n        artifact: { oci: { image: %s/telperiontech/%s, insecure: true, platforms: [linux/amd64, linux/arm64] } }\n",
				p.name, host, p.name)
			switch p.deploy {
			case "http":
				fmt.Fprintf(&b, "        deploy:\n          - http-check: { url: \"%s/run/%s/version.json\", version: { json: /version } }\n", base, p.name)
			case "coolify":
				fmt.Fprintf(&b, "        deploy:\n          - coolify-main: { app: %s }\n", p.name)
			}
		}
	}
	fmt.Fprintf(&b, `
  - name: sites
    repo: { git: %s/git/acme/sites.git }
    packages:
`, base)
	for _, p := range catalog() {
		if p.kind == site {
			fmt.Fprintf(&b, "      %s:\n        deploy:\n          - http-check: { url: \"%s/run/%s/version\", version: { header: X-Version } }\n",
				p.name, base, p.name)
		}
	}
	return b.String()
}
