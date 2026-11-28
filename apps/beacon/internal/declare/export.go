package declare

import (
	"strings"

	"go.yaml.in/yaml/v3"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

// Export writes a catalog as a config file. Defaults are left out, so the
// output applies back with no changes; package settings are written per
// package (the project-level defaults of the original file are not kept).
func Export(c catalog.Catalog) ([]byte, error) {
	f := File{GitHub: exportGitHub(c.GitHub)}
	if len(c.Targets) > 0 {
		f.Targets = map[string]TargetFile{}
	}
	for _, t := range c.Targets {
		tf := TargetFile{}
		if t.Limit != 1 {
			tf.Limit = t.Limit
		}
		if t.Coolify != nil {
			tf.Coolify = &CoolifyFile{URL: t.Coolify.URL, TokenEnv: t.Coolify.Token.Env, TokenFile: t.Coolify.Token.File}
		}
		f.Targets[t.Name] = tf
	}
	for _, p := range c.Projects {
		pf := ProjectFile{Name: p.Name, Repo: exportRepo(p.Repo), Packages: map[string]PackageFile{}}
		for _, pkg := range c.Packages {
			if pkg.Project == p.Name {
				pf.Packages[pkg.Name] = exportPackage(pkg)
			}
		}
		f.Projects = append(f.Projects, pf)
	}
	return yaml.Marshal(f)
}

func exportGitHub(g *catalog.GitHubApp) *GitHubFile {
	if g == nil {
		return nil
	}
	return &GitHubFile{
		AppID: g.AppID, PrivateKeyFile: g.PrivateKey.File, PrivateKeyEnv: g.PrivateKey.Env,
		APIURL: unlessDefault(g.APIURL, DefaultGitHubAPI), WebURL: unlessDefault(g.WebURL, DefaultGitHubWeb),
	}
}

func exportRepo(r catalog.Repo) RepoFile {
	if r.GitHub != "" {
		return RepoFile{GitHub: r.GitHub}
	}
	return RepoFile{Git: r.URL, User: r.User, TokenEnv: r.Auth.Env, TokenFile: r.Auth.File}
}

func exportPackage(p catalog.Package) PackageFile {
	pf := PackageFile{Tag: unlessDefault(p.Tag, catalog.DefaultTag)}
	if p.CI != nil && p.CI.GitHubActions != nil {
		pf.CI = &CIFile{GitHubActions: &GitHubActionsFile{Workflow: p.CI.GitHubActions.Workflow}}
	}
	if a := p.Artifact; a != nil && a.NPM != nil {
		pf.Artifact = &ArtifactFile{NPM: &NPMFile{
			Name: a.NPM.Name, Registry: unlessDefault(a.NPM.Registry, DefaultNPMRegistry),
			TokenEnv: a.NPM.Token.Env, TokenFile: a.NPM.Token.File,
		}}
	}
	if a := p.Artifact; a != nil && a.OCI != nil {
		image := a.OCI.Registry + "/" + a.OCI.Name
		if a.OCI.Registry == dockerHubRegistry {
			image = strings.TrimPrefix(a.OCI.Name, "library/")
		}
		pf.Artifact = &ArtifactFile{OCI: &OCIFile{
			Image: image, Platforms: a.OCI.Platforms, User: a.OCI.User, Insecure: a.OCI.Insecure,
			TokenEnv: a.OCI.Token.Env, TokenFile: a.OCI.Token.File,
		}}
	}
	for _, d := range p.Deploy {
		if d.HTTPCheck != nil {
			pf.Deploy = append(pf.Deploy, DeployFile{HTTPCheck: &HTTPCheckFile{
				Name: d.Target, URL: d.HTTPCheck.URL, Version: VersionFile(d.HTTPCheck.Version),
			}})
			continue
		}
		pf.Deploy = append(pf.Deploy, DeployFile{Target: d.Target, Coolify: &CoolifyAppFile{App: d.Coolify.App}})
	}
	return pf
}

func unlessDefault(v, def string) string {
	if v == def {
		return ""
	}
	return v
}
