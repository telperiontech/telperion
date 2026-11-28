package declare

// RecipeFile is a saved plan: steps keyed by name, ordered by needs.
type RecipeFile struct {
	Name     string              `yaml:"name"`
	FailFast bool                `yaml:"fail-fast,omitempty"` // a failure cancels the steps that have not started
	Steps    map[string]StepFile `yaml:"steps"`
}

// StepFile is one step: exactly one of release, update-deps and deploy.
//
//	js-utils:     { release: js-utils, bump: minor, needs: [extra-ts-types] }
//	ng-pack-deps: { update-deps: { package: ng-pack, deps: [js-utils], via: pr }, needs: [js-utils] }
//	gate-live:    { deploy: frp-gate, target: coolify-main, needs: [frp-gate] }
type StepFile struct {
	Release string `yaml:"release,omitempty"` // the package released
	Bump    string `yaml:"bump,omitempty"`    // major | minor | patch
	Version string `yaml:"version,omitempty"` // release: an exact version; deploy: the version (default: the plan's or the latest)
	Until   string `yaml:"until,omitempty"`   // tagged | built | published | deployed (default: the end of the chain)
	Batch   *bool  `yaml:"batch,omitempty"`   // false: not fired together with the repo's other releases

	UpdateDeps *UpdateDepsFile `yaml:"update-deps,omitempty"`

	Deploy string `yaml:"deploy,omitempty"` // the package deployed
	Target string `yaml:"target,omitempty"`

	Needs []string `yaml:"needs,omitempty"`
}

// UpdateDepsFile sets ^<version> in package's manifest for each of deps.
type UpdateDepsFile struct {
	Package string   `yaml:"package"`
	Deps    []string `yaml:"deps"`
	Via     string   `yaml:"via,omitempty"` // commit (default) | pr
}
