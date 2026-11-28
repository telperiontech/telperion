package model

// Plan is a set of steps ordered by needs (a DAG). A recipe is a named plan
// (from the YAML file, or saved from the UI); an ad-hoc plan from the UI is
// the same structure without a name. A run copies the plan at start, so
// editing a recipe never changes a running plan.
type Plan struct {
	Name     string     `json:"name,omitempty"`
	FailFast bool       `json:"failFast,omitempty"`
	Steps    []PlanStep `json:"steps"`
	// Managed: the recipe comes from the YAML file (the UI cannot change it).
	Managed bool `json:"managed,omitempty"`
}

// PlanStep is one step as written: what to do, not what it computed.
type PlanStep struct {
	Key     string   `json:"key"`
	Type    StepType `json:"type"`
	Package string   `json:"package"`
	Needs   []string `json:"needs,omitempty"`

	// release: a bump, or an exact version; done at Until (default: the end
	// of the package's chain).
	Bump    string `json:"bump,omitempty"`
	Version string `json:"version,omitempty"` // also deploy: the version (default: the plan's or the latest)
	Until   Stage  `json:"until,omitempty"`
	NoBatch bool   `json:"noBatch,omitempty"`

	// update-deps: Package's manifest gets ^<version> for each of Deps.
	Deps []string `json:"deps,omitempty"`
	Via  Via      `json:"via,omitempty"` // default commit

	Target string `json:"target,omitempty"` // deploy
}

// Step returns the plan step with that key.
func (p Plan) Step(key string) (PlanStep, bool) {
	for _, s := range p.Steps {
		if s.Key == key {
			return s, true
		}
	}
	return PlanStep{}, false
}

// Order returns the steps so that each comes after its needs (Kahn's
// algorithm, ties by position in the plan), and the keys left on a cycle
// (nil when there is none). Unknown needs are ignored here.
func (p Plan) Order() (ordered []PlanStep, cycle []string) {
	pending := map[string]int{}
	for _, s := range p.Steps {
		for _, n := range s.Needs {
			if _, ok := p.Step(n); ok {
				pending[s.Key]++
			}
		}
	}
	done := map[string]bool{}
	for len(done) < len(p.Steps) {
		progressed := false
		for _, s := range p.Steps {
			if done[s.Key] || pending[s.Key] > 0 {
				continue
			}
			done[s.Key], progressed = true, true
			ordered = append(ordered, s)
			for _, o := range p.Steps {
				for _, n := range o.Needs {
					if n == s.Key {
						pending[o.Key]--
					}
				}
			}
		}
		if !progressed {
			break
		}
	}
	for _, s := range p.Steps {
		if !done[s.Key] {
			cycle = append(cycle, s.Key)
		}
	}
	return ordered, cycle
}

// Ancestors returns every step key that key needs, directly or not.
func (p Plan) Ancestors(key string) map[string]bool {
	out := map[string]bool{}
	var walk func(string)
	walk = func(k string) {
		s, ok := p.Step(k)
		if !ok {
			return
		}
		for _, n := range s.Needs {
			if !out[n] {
				out[n] = true
				walk(n)
			}
		}
	}
	walk(key)
	return out
}
