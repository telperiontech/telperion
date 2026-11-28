package model

import (
	"slices"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/semver"
)

// Cell is the state of one version at one stage. For Deployed it combines the
// package's targets: ok only when every target runs the version.
type Cell struct {
	State   State        `json:"state"`
	Since   time.Time    `json:"since,omitzero"`
	URL     string       `json:"url,omitempty"`
	Detail  string       `json:"detail,omitempty"`
	Targets []TargetCell `json:"targets,omitempty"`
}

// TargetCell is the Deployed state on one target.
type TargetCell struct {
	Target string    `json:"target"`
	State  State     `json:"state"`
	Since  time.Time `json:"since,omitzero"`
	URL    string    `json:"url,omitempty"`
	Detail string    `json:"detail,omitempty"`
}

// Row is a stored stage state.
type Row struct {
	Version string
	Stage   Stage
	Target  string
	State   State
	Since   time.Time
	URL     string
	Detail  string
}

// VersionCells is one version of a package and its cell per chain stage.
type VersionCells struct {
	Version   string         `json:"version"`
	FirstSeen time.Time      `json:"firstSeen"`
	Cells     map[Stage]Cell `json:"cells"`
}

// Cells groups rows by version for a package whose chain is chain and whose
// deployment targets are targets, newest version first. versions gives the
// first-seen time of every known version.
func Cells(chain []Stage, targets []string, versions map[string]time.Time, rows []Row) []VersionCells {
	byVersion := map[string][]Row{}
	for _, r := range rows {
		byVersion[r.Version] = append(byVersion[r.Version], r)
	}
	out := make([]VersionCells, 0, len(versions))
	for v, first := range versions {
		vc := VersionCells{Version: v, FirstSeen: first, Cells: map[Stage]Cell{}}
		for _, st := range chain {
			vc.Cells[st] = cell(st, targets, byVersion[v])
		}
		out = append(out, vc)
	}
	slices.SortFunc(out, func(a, b VersionCells) int { return semver.CompareStrings(b.Version, a.Version) })
	return out
}

func cell(st Stage, targets []string, rows []Row) Cell {
	if st != Deployed {
		for _, r := range rows {
			if r.Stage == st {
				return Cell{State: r.State, Since: r.Since, URL: r.URL, Detail: r.Detail}
			}
		}
		return Cell{State: Missing}
	}
	tc := make([]TargetCell, 0, len(targets))
	for _, t := range targets {
		c := TargetCell{Target: t, State: Missing}
		for _, r := range rows {
			if r.Stage == Deployed && r.Target == t {
				c = TargetCell{Target: t, State: r.State, Since: r.Since, URL: r.URL, Detail: r.Detail}
			}
		}
		tc = append(tc, c)
	}
	return combine(tc)
}

// combine: ok when every target is ok (since the last of them); otherwise the
// most telling of pending, failed, missing.
func combine(tc []TargetCell) Cell {
	c := Cell{State: OK, Targets: tc}
	if len(tc) == 0 {
		return Cell{State: Missing}
	}
	for _, t := range tc {
		if t.State == OK && t.Since.After(c.Since) {
			c.Since = t.Since
		}
	}
	for _, want := range []State{Pending, Failed, Missing} {
		for _, t := range tc {
			if t.State == want && c.State == OK {
				c = Cell{State: want, Since: t.Since, Detail: t.Target + ": " + t.Detail, Targets: tc}
			}
		}
	}
	return c
}
