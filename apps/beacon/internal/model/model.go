// Package model holds Beacon's domain types and rules: stages, states,
// observations, and how a package's chain turns into gaps. Pure: no I/O.
package model

import "time"

// Stage is a step of a package's release chain.
type Stage string

// The stages in chain order.
const (
	Tagged    Stage = "tagged"    // source: a tag names the version
	Built     Stage = "built"     // CI: the run the tag started
	Published Stage = "published" // artifact: npm version, OCI tag
	Deployed  Stage = "deployed"  // runtime: per target
)

// Stages lists every stage in chain order.
var Stages = []Stage{Tagged, Built, Published, Deployed}

// Index is the stage's position in Stages (-1 if unknown).
func (s Stage) Index() int {
	for i, x := range Stages {
		if x == s {
			return i
		}
	}
	return -1
}

// State is where one version stands at one stage.
type State string

// States. A stage with no row is Missing.
const (
	Missing State = "missing"
	Pending State = "pending" // started (CI queued or running, image packaged)
	OK      State = "ok"
	Failed  State = "failed"
)

// Valid reports whether s is one of the four states.
func (s State) Valid() bool { return s == Missing || s == Pending || s == OK || s == Failed }

// Obs is an observation: what an adapter saw for one package version at one
// stage (and target, for deployments).
type Obs struct {
	Package string
	Version string
	Stage   Stage
	Target  string // deployment target; "" for other stages
	State   State
	At      time.Time // when the platform says it happened; zero: when observed
	URL     string    // CI run, registry page, ...
	Detail  string    // short, never secret

	// Exclusive: this is the only version in State for (Package, Stage,
	// Target); other versions there drop to Missing. A runtime runs one
	// version per target.
	Exclusive bool
}
