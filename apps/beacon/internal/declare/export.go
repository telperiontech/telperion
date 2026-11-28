package declare

import (
	"maps"
	"strings"

	"go.yaml.in/yaml/v3"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

// Export writes a catalog as a config file. Defaults are left out, so the
// output applies back with no changes; package settings are written per
// package (the project-level defaults of the original file are not kept).
func Export(c catalog.Catalog) ([]byte, error) {
	f := File{GitHub: exportGitHub(c.GitHub), CDEvents: exportCDEvents(c.CDEvents)}
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
		WebhookSecretEnv: g.WebhookSecret.Env, WebhookSecretFile: g.WebhookSecret.File,
		APIURL: unlessDefault(g.APIURL, DefaultGitHubAPI), WebURL: unlessDefault(g.WebURL, DefaultGitHubWeb),
	}
}

func exportCDEvents(sources []catalog.CDEventsSource) *CDEventsFile {
	if len(sources) == 0 {
		return nil
	}
	f := &CDEventsFile{}
	for _, s := range sources {
		f.Sources = append(f.Sources, CDEventsSourceFile{
			Name: s.Name, TokenEnv: s.Token.Env, TokenFile: s.Token.File, Packages: s.Packages,
		})
	}
	return f
}

func exportRelease(r *catalog.Release) *ReleaseFile {
	switch {
	case r == nil:
		return nil
	case r.GitHubRelease != nil:
		return &ReleaseFile{GitHubRelease: &GitHubReleaseFile{
			Notes: unlessDefault(r.GitHubRelease.Notes, catalog.NotesGenerate), TagOnly: r.GitHubRelease.TagOnly,
		}}
	case r.GitHubDispatch != nil:
		d := &GitHubDispatchFile{Workflow: r.GitHubDispatch.Workflow}
		if !maps.Equal(r.GitHubDispatch.Inputs, defaultDispatchInputs) {
			d.Inputs = r.GitHubDispatch.Inputs
		}
		return &ReleaseFile{GitHubDispatch: d}
	}
	return &ReleaseFile{Webhook: &WebhookFile{
		URL: r.Webhook.URL, SecretEnv: r.Webhook.Secret.Env, SecretFile: r.Webhook.Secret.File,
	}}
}

func exportRepo(r catalog.Repo) RepoFile {
	if r.GitHub != "" {
		return RepoFile{GitHub: r.GitHub}
	}
	return RepoFile{Git: r.URL, User: r.User, TokenEnv: r.Auth.Env, TokenFile: r.Auth.File}
}

func exportPackage(p catalog.Package) PackageFile {
	pf := PackageFile{
		Tag: unlessDefault(p.Tag, catalog.DefaultTag), Branch: p.Branch, Path: p.Path, Release: exportRelease(p.Release),
	}
	switch {
	case p.CI != nil && p.CI.GitHubActions != nil:
		pf.CI = &CIFile{GitHubActions: &GitHubActionsFile{Workflow: p.CI.GitHubActions.Workflow}}
	case p.CI != nil && p.CI.CDEvents:
		pf.CI = &CIFile{CDEvents: true}
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
		switch {
		case d.HTTPCheck != nil:
			pf.Deploy = append(pf.Deploy, DeployFile{HTTPCheck: &HTTPCheckFile{
				Name: d.Target, URL: d.HTTPCheck.URL, Version: VersionFile(d.HTTPCheck.Version),
			}})
		case d.CDEvents:
			pf.Deploy = append(pf.Deploy, DeployFile{CDEvents: &CDEventsDeployFile{Environment: d.Target}})
		default:
			pf.Deploy = append(pf.Deploy, DeployFile{Target: d.Target, Coolify: &CoolifyAppFile{App: d.Coolify.App}})
		}
	}
	return pf
}

func unlessDefault(v, def string) string {
	if v == def {
		return ""
	}
	return v
}
