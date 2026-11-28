package catalog

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

var stepKey = regexp.MustCompile(`^[a-z0-9][a-z0-9._@-]{0,62}$`)

// Recipe returns the recipe named name.
func (c Catalog) Recipe(name string) (model.Plan, bool) {
	i := slices.IndexFunc(c.Recipes, func(p model.Plan) bool { return p.Name == name })
	if i < 0 {
		return model.Plan{}, false
	}
	return c.Recipes[i], true
}

// CheckPlan validates a plan against the catalog: step keys, types and
// their fields, known packages and targets, needs without cycles, and that a
// step using a version released in the plan comes after that release. It
// returns one message per problem, each prefixed with the step key.
func (c Catalog) CheckPlan(p model.Plan) []string {
	var errs []string
	fail := func(key, format string, args ...any) {
		errs = append(errs, key+": "+fmt.Sprintf(format, args...))
	}
	if len(p.Steps) == 0 {
		return []string{"a plan needs at least one step"}
	}
	seen := map[string]bool{}
	released := map[string]string{} // package → the key of its release step
	for _, s := range p.Steps {
		switch {
		case !stepKey.MatchString(s.Key):
			fail(s.Key, "not a valid step key (lower-case letters, digits, . _ @ -)")
		case seen[s.Key]:
			fail(s.Key, "two steps have this key")
		}
		seen[s.Key] = true
		if s.Type == model.StepRelease {
			if other, ok := released[s.Package]; ok {
				fail(s.Key, "%s is released by step %s already", s.Package, other)
			}
			released[s.Package] = s.Key
		}
	}
	for _, s := range p.Steps {
		for _, n := range s.Needs {
			if _, ok := p.Step(n); !ok {
				fail(s.Key, "needs %q, which is not a step of the plan", n)
			}
			if n == s.Key {
				fail(s.Key, "needs itself")
			}
		}
		c.checkStep(s, fail)
		c.checkOrder(p, s, released, fail)
	}
	if _, cycle := p.Order(); len(cycle) > 0 {
		errs = append(errs, "the needs form a cycle: "+strings.Join(cycle, ", "))
	}
	return errs
}

func (c Catalog) checkStep(s model.PlanStep, fail func(key, format string, args ...any)) {
	pkg, ok := c.Package(s.Package)
	if !ok {
		fail(s.Key, "unknown package %q", s.Package)
		return
	}
	switch s.Type {
	case model.StepRelease:
		if s.Bump == "" && s.Version == "" {
			fail(s.Key, "a release needs a bump (major, minor, patch) or a version")
		}
		if s.Bump != "" && s.Version != "" {
			fail(s.Key, "set either bump or version, not both")
		}
		if s.Until != "" && !slices.Contains(pkg.Chain(), s.Until) {
			fail(s.Key, "until %q is not a stage of %s (%s)", s.Until, pkg.Name, chainString(pkg.Chain()))
		}
		if pkg.Release == nil {
			fail(s.Key, "%s has no release trigger", pkg.Name)
		}
	case model.StepUpdateDeps:
		if len(s.Deps) == 0 {
			fail(s.Key, "update-deps needs at least one dependency")
		}
		if s.Via != "" && s.Via != model.ViaCommit && s.Via != model.ViaPR {
			fail(s.Key, "via is commit or pr, not %q", s.Via)
		}
		if pkg.Repo.GitHub == "" {
			fail(s.Key, "update-deps writes through GitHub; %s is not in a GitHub repo", pkg.Name)
		}
		for _, d := range s.Deps {
			dep, ok := c.Package(d)
			switch {
			case !ok:
				fail(s.Key, "unknown dependency %q", d)
			case dep.Artifact == nil || dep.Artifact.NPM == nil:
				fail(s.Key, "the dependency %s has no npm artifact (update-deps edits package.json)", d)
			}
		}
	case model.StepDeploy:
		if d, ok := pkg.DeployTo(s.Target); !ok || d.Coolify == nil {
			fail(s.Key, "%s cannot be deployed to %q (only Coolify targets of the package can)", pkg.Name, s.Target)
		}
	default:
		fail(s.Key, "unknown step type %q (release, update-deps or deploy)", s.Type)
	}
}

// checkOrder: a step that uses a version released in the plan must come
// after that release, or it would use a version that does not exist yet.
func (c Catalog) checkOrder(p model.Plan, s model.PlanStep, released map[string]string, fail func(key, format string, args ...any)) {
	uses := map[model.StepType][]string{model.StepDeploy: {s.Package}, model.StepUpdateDeps: s.Deps}[s.Type]
	before := p.Ancestors(s.Key)
	for _, pkg := range uses {
		if r, ok := released[pkg]; ok && r != s.Key && !before[r] {
			fail(s.Key, "uses the version of %s that step %s releases: add %s to its needs", pkg, r, r)
		}
	}
}

func chainString(chain []model.Stage) string {
	parts := make([]string, len(chain))
	for i, s := range chain {
		parts[i] = string(s)
	}
	return strings.Join(parts, " → ")
}
