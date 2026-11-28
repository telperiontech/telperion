package declare

import (
	"go.yaml.in/yaml/v3"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// ExportRecipes writes plans as the recipes: section of a config file, e.g.
// to copy an ad-hoc plan from the UI into the file.
func ExportRecipes(plans ...model.Plan) ([]byte, error) {
	f := struct {
		Recipes []RecipeFile `yaml:"recipes"`
	}{}
	for _, p := range plans {
		f.Recipes = append(f.Recipes, exportRecipe(p))
	}
	return yaml.Marshal(f)
}

func exportRecipe(p model.Plan) RecipeFile {
	f := RecipeFile{Name: p.Name, FailFast: p.FailFast, Steps: map[string]StepFile{}}
	for _, s := range p.Steps {
		sf := StepFile{Needs: s.Needs}
		switch s.Type {
		case model.StepRelease:
			sf.Release, sf.Bump, sf.Version, sf.Until = s.Package, s.Bump, s.Version, string(s.Until)
			if s.NoBatch {
				sf.Batch = new(bool)
			}
		case model.StepUpdateDeps:
			sf.UpdateDeps = &UpdateDepsFile{Package: s.Package, Deps: s.Deps}
			if s.Via != model.ViaCommit {
				sf.UpdateDeps.Via = string(s.Via)
			}
		case model.StepDeploy:
			sf.Deploy, sf.Target, sf.Version = s.Package, s.Target, s.Version
		}
		f.Steps[s.Key] = sf
	}
	return f
}
