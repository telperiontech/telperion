package model

import "time"

// StepType is what a plan step does. A one-click action is a one-step plan.
type StepType string

// Step types.
const (
	StepRelease    StepType = "release"     // fire the package's trigger with a computed version
	StepUpdateDeps StepType = "update-deps" // set dependency ranges in a package's manifest
	StepDeploy     StepType = "deploy"      // set the version a target runs
	StepRerun      StepType = "rerun"       // re-run the failed CI run of a version (an action only)
)

// StepState is where a step stands. A step is done when the chain says so,
// not when it was triggered.
type StepState string

// Step states: waiting (needs not done) → ready → blocked (lock or limit) →
// triggering → running → done | failed; paused (an update-deps PR waits to
// be merged), skipped (a need failed), cancelled.
const (
	StepWaiting    StepState = "waiting"
	StepReady      StepState = "ready"
	StepBlocked    StepState = "blocked"
	StepTriggering StepState = "triggering"
	StepRunning    StepState = "running"
	StepPaused     StepState = "paused"
	StepDone       StepState = "done"
	StepFailed     StepState = "failed"
	StepSkipped    StepState = "skipped"
	StepCancelled  StepState = "cancelled"
)

// Terminal reports whether the step has finished, one way or another.
func (s StepState) Terminal() bool {
	return s == StepDone || s == StepFailed || s == StepSkipped || s == StepCancelled
}

// Started reports whether the step has fired (what it started goes on even
// when the plan stops).
func (s StepState) Started() bool {
	return s == StepRunning || s == StepPaused
}

// RunState is a plan run's outcome so far.
type RunState string

// Run states.
const (
	RunRunning   RunState = "running"
	RunDone      RunState = "done"
	RunFailed    RunState = "failed"
	RunCancelled RunState = "cancelled"
)

// Via is how an update-deps step writes: a commit on the branch, or a pull
// request the plan waits on.
type Via string

// Ways of writing a dependency update.
const (
	ViaCommit Via = "commit"
	ViaPR     Via = "pr"
)

// DepChange is one dependency range an update-deps step sets.
type DepChange struct {
	Package string `json:"package"`        // the Beacon package depended on
	Name    string `json:"name"`           // its name in the manifest, e.g. @telperion/js-utils
	Version string `json:"version"`        // the version it reaches (in the plan, or its latest)
	From    string `json:"from,omitempty"` // the range before ("" when it is not a dependency)
	To      string `json:"to"`             // the range after, ^<version>
}

// Step is one step of a plan run, with what it decided and observed. The
// version of a release is computed once, when the run is started, and kept:
// a retry never skips a version.
type Step struct {
	Key     string   `json:"key"`
	Type    StepType `json:"type"`
	Package string   `json:"package"`
	Bump    string   `json:"bump,omitempty"`    // release: major | minor | patch ("" for an exact version)
	Version string   `json:"version,omitempty"` // the version released, deployed or re-built
	From    string   `json:"from,omitempty"`    // the version before (latest release, or running on the target)
	Tag     string   `json:"tag,omitempty"`     // release, rerun
	Target  string   `json:"target,omitempty"`  // deploy
	Until   Stage    `json:"until,omitempty"`   // release, rerun: done when this stage is ok
	Needs   []string `json:"needs,omitempty"`   // keys of steps that must be done first
	Branch  string   `json:"branch,omitempty"`  // release, update-deps: the branch written to
	Commit  string   `json:"commit,omitempty"`  // release: the commit tagged; update-deps: the commit made
	Adopted bool     `json:"adopted,omitempty"` // its result existed already; nothing was fired
	NoBatch bool     `json:"noBatch,omitempty"` // release: fire alone, not with the repo's other releases

	// update-deps
	Via  Via         `json:"via,omitempty"`
	File string      `json:"file,omitempty"` // the manifest, e.g. libs/ng-pack/package.json
	Deps []DepChange `json:"deps,omitempty"`
	PR   int         `json:"pr,omitempty"` // the pull request opened (via pr)
	// Attempt counts resumes of the step (a resumed pull request step opens
	// a new branch).
	Attempt int `json:"attempt,omitempty"`

	State    StepState `json:"state"`
	Detail   string    `json:"detail,omitempty"`
	URL      string    `json:"url,omitempty"`
	DeployID string    `json:"deployId,omitempty"` // deploy: the started deployment
	Fired    time.Time `json:"fired,omitzero"`     // when it was triggered (running since)
	Progress time.Time `json:"progress,omitzero"`  // the last observed progress
	Finished time.Time `json:"finished,omitzero"`
}

// Run is a plan run: a copy of the plan at start time and its steps' states.
type Run struct {
	ID       int64     `json:"id"`
	Title    string    `json:"title"`
	State    RunState  `json:"state"`
	Source   string    `json:"source"` // ui | api
	Actor    string    `json:"actor"`
	Recipe   string    `json:"recipe,omitempty"`   // the recipe it was started from
	FailFast bool      `json:"failFast,omitempty"` // a failure cancels the steps that have not started
	Plan     *Plan     `json:"plan,omitempty"`     // the plan as started (multi-step plans)
	Created  time.Time `json:"created"`
	Finished time.Time `json:"finished,omitzero"`
	Steps    []Step    `json:"steps"`
}

// Step returns the step with that key.
func (r *Run) Step(key string) *Step {
	for i := range r.Steps {
		if r.Steps[i].Key == key {
			return &r.Steps[i]
		}
	}
	return nil
}
