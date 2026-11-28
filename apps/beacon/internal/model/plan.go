package model

import "time"

// StepType is what a plan step does. A one-click action is a one-step plan.
type StepType string

// Step types. Phase 3 adds update-deps.
const (
	StepRelease StepType = "release" // fire the package's trigger with a computed version
	StepDeploy  StepType = "deploy"  // set the version a target runs
	StepRerun   StepType = "rerun"   // re-run the failed CI run of a version
)

// StepState is where a step stands. A step is done when the chain says so,
// not when it was triggered.
type StepState string

// Step states: waiting (needs not done) → ready → blocked (lock or limit) →
// triggering → running → done | failed; skipped (a need failed), cancelled.
const (
	StepWaiting    StepState = "waiting"
	StepReady      StepState = "ready"
	StepBlocked    StepState = "blocked"
	StepTriggering StepState = "triggering"
	StepRunning    StepState = "running"
	StepDone       StepState = "done"
	StepFailed     StepState = "failed"
	StepSkipped    StepState = "skipped"
	StepCancelled  StepState = "cancelled"
)

// Terminal reports whether the step has finished, one way or another.
func (s StepState) Terminal() bool {
	return s == StepDone || s == StepFailed || s == StepSkipped || s == StepCancelled
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

// Step is one step of a plan run, with what it decided and observed. The
// version of a release is computed once, when the run is started, and kept:
// a retry never skips a version.
type Step struct {
	Key     string   `json:"key"`
	Type    StepType `json:"type"`
	Package string   `json:"package"`
	Bump    string   `json:"bump,omitempty"`    // release: major | minor | patch ("" for an exact version)
	Version string   `json:"version"`           // the version released, deployed or re-built
	From    string   `json:"from,omitempty"`    // the version before (latest release, or running on the target)
	Tag     string   `json:"tag,omitempty"`     // release, rerun
	Target  string   `json:"target,omitempty"`  // deploy
	Until   Stage    `json:"until,omitempty"`   // release, rerun: done when this stage is ok
	Needs   []string `json:"needs,omitempty"`   // keys of steps that must be done first
	Branch  string   `json:"branch,omitempty"`  // release: the branch tagged
	Commit  string   `json:"commit,omitempty"`  // release: the commit tagged, read when it fired
	Adopted bool     `json:"adopted,omitempty"` // its result existed already; nothing was fired

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
