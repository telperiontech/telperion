package declare

import (
	"fmt"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// recipes resolves the saved plans and checks them against the catalog.
func (r *resolver) recipes(files []RecipeFile, c catalog.Catalog) []model.Plan {
	out := make([]model.Plan, 0, len(files))
	names := map[string]bool{}
	for i, f := range files {
		path := fmt.Sprintf("recipes[%d]", i)
		r.name(path+".name", f.Name)
		if f.Name != "" {
			path = "recipes." + f.Name
		}
		if names[f.Name] {
			r.fail(path, "two recipes have this name")
		}
		names[f.Name] = true
		p := model.Plan{Name: f.Name, FailFast: f.FailFast, Managed: true}
		for _, key := range sortedKeys(f.Steps) {
			p.Steps = append(p.Steps, r.step(path+".steps."+key, key, f.Steps[key]))
		}
		for _, msg := range c.CheckPlan(p) {
			r.fail(path+".steps", "%s", msg)
		}
		out = append(out, p)
	}
	return out
}

func (r *resolver) step(path, key string, f StepFile) model.PlanStep {
	s := model.PlanStep{Key: key, Needs: f.Needs, Version: f.Version, Until: model.Stage(f.Until)}
	kinds := 0
	if f.Release != "" {
		kinds++
		s.Type, s.Package, s.Bump, s.NoBatch = model.StepRelease, f.Release, f.Bump, f.Batch != nil && !*f.Batch
	}
	if f.UpdateDeps != nil {
		kinds++
		s.Type, s.Package, s.Deps, s.Via = model.StepUpdateDeps, f.UpdateDeps.Package, f.UpdateDeps.Deps, model.Via(or(f.UpdateDeps.Via, string(model.ViaCommit)))
	}
	if f.Deploy != "" {
		kinds++
		s.Type, s.Package, s.Target = model.StepDeploy, f.Deploy, f.Target
	}
	if kinds != 1 {
		r.fail(path, "set exactly one of release, update-deps and deploy")
		return s
	}
	var stray []string
	if s.Type != model.StepRelease {
		stray = append(stray, present(map[string]bool{"bump": f.Bump != "", "until": f.Until != "", "batch": f.Batch != nil})...)
	}
	if s.Type != model.StepDeploy && f.Target != "" {
		stray = append(stray, "target")
	}
	if s.Type == model.StepUpdateDeps && f.Version != "" {
		stray = append(stray, "version")
	}
	if len(stray) > 0 {
		r.fail(path, "%s do(es) not apply to a %s step", strings.Join(stray, ", "), s.Type)
	}
	return s
}

func present(m map[string]bool) []string {
	var out []string
	for _, k := range sortedKeys(m) {
		if m[k] {
			out = append(out, k)
		}
	}
	return out
}
