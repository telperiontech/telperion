package plan

import (
	"fmt"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Request is what to preview or start: a one-click action (Kind and its
// fields), a recipe by name, or an ad-hoc plan.
type Request struct {
	Kind    model.StepType `json:"kind,omitempty"`    // release | deploy | rerun
	Package string         `json:"package,omitempty"` // the package
	Bump    string         `json:"bump,omitempty"`    // release: major | minor | patch
	Version string         `json:"version,omitempty"` // release: an exact version instead of a bump; deploy, rerun: the version
	Target  string         `json:"target,omitempty"`  // deploy

	Recipe string      `json:"recipe,omitempty"` // a recipe of the catalog
	Plan   *model.Plan `json:"plan,omitempty"`   // an ad-hoc plan from the plan builder
}

// action reports whether the request is a one-click action.
func (r Request) action() bool { return r.Recipe == "" && r.Plan == nil }

// plan is the request as a plan, with the recipe it came from ("" for an
// ad-hoc plan or an action).
func (r Request) plan(c catalog.Catalog) (model.Plan, string, error) {
	switch {
	case r.Recipe != "" && r.Plan != nil:
		return model.Plan{}, "", fmt.Errorf("send either a recipe or a plan, not both")
	case r.Recipe != "":
		p, ok := c.Recipe(r.Recipe)
		if !ok {
			return model.Plan{}, "", fmt.Errorf("unknown recipe %q", r.Recipe)
		}
		return p, p.Name, nil
	case r.Plan != nil:
		p := *r.Plan
		p.Managed = false
		return p, "", nil
	}
	key := r.Package
	if r.Kind == model.StepDeploy {
		key += "@" + r.Target
	}
	return model.Plan{Steps: []model.PlanStep{{
		Key: key, Type: r.Kind, Package: r.Package, Bump: r.Bump, Version: r.Version, Target: r.Target,
	}}}, "", nil
}

// planTitle names a multi-step run: the recipe, or the packages it touches.
func planTitle(p model.Plan) string {
	if p.Name != "" {
		return p.Name
	}
	var pkgs []string
	seen := map[string]bool{}
	for _, s := range p.Steps {
		if !seen[s.Package] {
			seen[s.Package] = true
			pkgs = append(pkgs, s.Package)
		}
	}
	if len(pkgs) > 4 {
		pkgs = append(pkgs[:4], fmt.Sprintf("%d more", len(pkgs)-4))
	}
	return fmt.Sprintf("plan of %d steps: %s", len(p.Steps), strings.Join(pkgs, ", "))
}
