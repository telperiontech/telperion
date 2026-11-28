// Package plan runs Beacon's writes. Every write is a step of a plan run: a
// one-click action (release, deploy, re-run) is a one-step plan, so previews,
// locks, limits, audit and the step state machine are one code path. Phase 3
// adds multi-step plans (needs:) on the same machinery.
//
// A step is done when the chain says so, not when it was triggered: firing
// only moves it to running; observations move it to done or failed. Before
// every write the step checks whether its result already exists and adopts
// it, so a retried or restarted step never fires twice for one version.
package plan

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// Platform is what plans read and write through: the adapters of the
// current catalog (bind.Set).
type Platform interface {
	Refs(ctx context.Context, repo catalog.Repo) (adapter.Refs, error)
	Trigger(p catalog.Package) (adapter.Trigger, bool)
	Rerunner(p catalog.Package) (adapter.Rerunner, bool)
	Deployer(p catalog.Package, target string) (adapter.Deployer, catalog.Deploy, bool)
}

// Env is the planner's and runner's world.
type Env struct {
	Store    *store.Store
	Platform func(catalog.Catalog) (Platform, error)
	Wake     func(packages ...string) // poll these packages now (and hot)
	Publish  func(observe.Notice)
	Log      *slog.Logger
	Now      func() time.Time
}

// Request is a one-click action.
type Request struct {
	Kind    model.StepType `json:"kind"`              // release | deploy | rerun
	Package string         `json:"package"`           // the package
	Bump    string         `json:"bump,omitempty"`    // release: major | minor | patch
	Version string         `json:"version,omitempty"` // release: an exact version instead of a bump; deploy, rerun: the version
	Target  string         `json:"target,omitempty"`  // deploy
}

// Errors of Start. The preview that goes with them says why.
var (
	ErrInvalid = errors.New("the plan has errors")
	ErrMoved   = errors.New("the state changed since the preview; check the new preview")
	ErrConfirm = errors.New("a major version change needs its own confirmation")
)

// Timeouts of running steps.
const (
	// TagTimeout: a release whose tag has not appeared by then failed (the
	// trigger did not create it).
	TagTimeout = 30 * time.Minute
	// StallTimeout: a running step with no observed progress for this long
	// failed.
	StallTimeout = 2 * time.Hour
)

func (e Env) now() time.Time {
	if e.Now != nil {
		return e.Now()
	}
	return time.Now()
}

func (e Env) wake(pkgs ...string) {
	if e.Wake != nil {
		e.Wake(pkgs...)
	}
}

func (e Env) publish(n observe.Notice) {
	if e.Publish != nil {
		e.Publish(n)
	}
}

// lock names.
func packageLock(pkg string) string  { return "package:" + pkg }
func repoLock(r catalog.Repo) string { return "repo:" + r.URL }
func lastStage(p catalog.Package) model.Stage {
	chain := p.Chain()
	return chain[len(chain)-1]
}
