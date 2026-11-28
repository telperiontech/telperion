package declare

import "github.com/telperiontech/telperion/apps/beacon/internal/catalog"

// crossChecks: unique names, and tag patterns of one repo that would claim the
// same tag for two packages.
func (r *resolver) crossChecks(c catalog.Catalog) {
	seen := map[string]bool{}
	for _, p := range c.Projects {
		if seen[p.Name] {
			r.fail("projects."+p.Name, "duplicate project name")
		}
		seen[p.Name] = true
	}
	owner := map[string]string{}
	for _, p := range c.Packages {
		if prev, dup := owner[p.Name]; dup {
			r.fail("packages."+p.Name, "the name is used in projects %s and %s; package names are unique", prev, p.Project)
		}
		owner[p.Name] = p.Project
		targets := map[string]bool{}
		for _, d := range p.Deploy {
			if targets[d.Target] {
				r.fail("packages."+p.Name+".deploy", "target %q appears twice", d.Target)
			}
			targets[d.Target] = true
		}
	}
	for i, a := range c.Packages {
		for _, b := range c.Packages[i+1:] {
			if a.Repo.URL != b.Repo.URL {
				continue
			}
			ma, errA := catalog.NewTagMatcher(a.Tag, a.Name)
			mb, errB := catalog.NewTagMatcher(b.Tag, b.Name)
			if errA != nil || errB != nil {
				continue
			}
			if _, clash := mb.Version(ma.Tag("1.2.3")); clash {
				r.fail("packages."+a.Name+".tag", "tag %s would also match package %s", ma.Tag("1.2.3"), b.Name)
			} else if _, clash := ma.Version(mb.Tag("1.2.3")); clash {
				r.fail("packages."+b.Name+".tag", "tag %s would also match package %s", mb.Tag("1.2.3"), a.Name)
			}
		}
	}
}
