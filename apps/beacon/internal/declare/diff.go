package declare

import (
	"encoding/json"
	"fmt"
	"maps"
	"reflect"
	"slices"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Change is one difference between the stored catalog and the file.
type Change struct {
	Op     string // "+" add, "-" remove, "~" update
	Kind   string // github, target, project, package
	Name   string
	Fields []string // for updates: the top-level fields that differ
}

func (c Change) String() string {
	s := fmt.Sprintf("%s %s %s", c.Op, c.Kind, c.Name)
	if len(c.Fields) > 0 {
		s += " (" + strings.Join(c.Fields, ", ") + ")"
	}
	return s
}

// Diff lists what applying next over cur changes, in a stable order.
func Diff(cur, next catalog.Catalog) []Change {
	var out []Change
	out = append(out, diffNamed("github", byName(optional(cur.GitHub), func(*catalog.GitHubApp) string { return "app" }),
		byName(optional(next.GitHub), func(*catalog.GitHubApp) string { return "app" }))...)
	out = append(out, diffNamed("target", byName(cur.Targets, func(t catalog.Target) string { return t.Name }),
		byName(next.Targets, func(t catalog.Target) string { return t.Name }))...)
	out = append(out, diffNamed("project", byName(cur.Projects, func(p catalog.Project) string { return p.Name }),
		byName(next.Projects, func(p catalog.Project) string { return p.Name }))...)
	out = append(out, diffNamed("package", byName(cur.Packages, func(p catalog.Package) string { return p.Name }),
		byName(next.Packages, func(p catalog.Package) string { return p.Name }))...)
	out = append(out, diffNamed("cdevents source", byName(cur.CDEvents, func(s catalog.CDEventsSource) string { return s.Name }),
		byName(next.CDEvents, func(s catalog.CDEventsSource) string { return s.Name }))...)
	out = append(out, diffNamed("recipe", byName(managed(cur.Recipes), func(p model.Plan) string { return p.Name }),
		byName(next.Recipes, func(p model.Plan) string { return p.Name }))...)
	return out
}

func optional[T any](p *T) []*T {
	if p == nil {
		return nil
	}
	return []*T{p}
}

func byName[T any](items []T, name func(T) string) map[string]any {
	m := map[string]any{}
	for _, it := range items {
		m[name(it)] = it
	}
	return m
}

func diffNamed(kind string, cur, next map[string]any) []Change {
	var out []Change
	names := slices.Sorted(maps.Keys(merge(cur, next)))
	for _, n := range names {
		a, inCur := cur[n]
		b, inNext := next[n]
		switch {
		case !inCur:
			out = append(out, Change{Op: "+", Kind: kind, Name: n})
		case !inNext:
			out = append(out, Change{Op: "-", Kind: kind, Name: n})
		default:
			if fields := changedFields(a, b); len(fields) > 0 {
				out = append(out, Change{Op: "~", Kind: kind, Name: n, Fields: fields})
			}
		}
	}
	return out
}

// changedFields compares two values through their JSON form, top-level keys.
func changedFields(a, b any) []string {
	var ma, mb map[string]any
	ja, _ := json.Marshal(a)
	jb, _ := json.Marshal(b)
	_ = json.Unmarshal(ja, &ma)
	_ = json.Unmarshal(jb, &mb)
	var fields []string
	for _, k := range slices.Sorted(maps.Keys(merge(ma, mb))) {
		if !reflect.DeepEqual(ma[k], mb[k]) {
			fields = append(fields, k)
		}
	}
	return fields
}

func merge(a, b map[string]any) map[string]any {
	m := maps.Clone(a)
	if m == nil {
		m = map[string]any{}
	}
	maps.Copy(m, b)
	return m
}

// managed leaves out the recipes saved from the UI: applying the file never
// touches them (a file recipe of the same name replaces one, though).
func managed(plans []model.Plan) []model.Plan {
	var out []model.Plan
	for _, p := range plans {
		if p.Managed {
			out = append(out, p)
		}
	}
	return out
}
