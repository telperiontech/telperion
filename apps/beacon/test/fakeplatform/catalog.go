package main

import (
	"fmt"
	"time"
)

// A synthetic catalog the size of the telperion repo (~30 packages). Versions
// below base appeared long ago; from then on a new version appears every
// period, and each one moves through the chain on a fixed timeline, so the
// observation loop sees tags, pending and finished runs, publishes and
// deploys while the check runs.

type kind int

const (
	npmLib kind = iota // tagged → built → published (npm)
	image              // tagged → built → published (oci) → deployed
	site               // plain git repo, tagged → deployed (http-check)
)

type fakePkg struct {
	name    string
	kind    kind
	base    int    // versions that existed before start
	deploy  string // "http", "coolify" or ""
	amd64   bool   // image index without arm64
	bigDocs bool   // a multi-MB npm packument
}

func catalog() []fakePkg {
	var out []fakePkg
	for i := 1; i <= 20; i++ {
		out = append(out, fakePkg{name: fmt.Sprintf("lib-%02d", i), kind: npmLib, base: 10 + i*3, bigDocs: i == 1})
	}
	for i := 1; i <= 8; i++ {
		p := fakePkg{name: fmt.Sprintf("svc-%02d", i), kind: image, base: 5 + i, amd64: i == 3}
		switch {
		case i <= 4:
			p.deploy = "http"
		case i <= 6:
			p.deploy = "coolify"
		}
		out = append(out, p)
	}
	for i := 1; i <= 2; i++ {
		out = append(out, fakePkg{name: fmt.Sprintf("site-%02d", i), kind: site, base: 3, deploy: "http"})
	}
	return out
}

// Timeline of a version after its tag appears.
const (
	runStarts   = 5 * time.Second
	runEnds     = 40 * time.Second
	publishedAt = 70 * time.Second
	deployedAt  = 150 * time.Second
)

type world struct {
	start  time.Time
	period time.Duration
	now    func() time.Time
}

// tagTime is when version k of p was tagged.
func (w world) tagTime(p fakePkg, k int) time.Time {
	if k < p.base {
		return w.start.Add(-time.Duration(p.base-k) * 24 * time.Hour)
	}
	// stagger packages so new versions do not all land at once
	offset := time.Duration(len(p.name)*7+int(p.name[len(p.name)-1])) * time.Second % w.period
	return w.start.Add(offset + time.Duration(k-p.base)*w.period)
}

// versions are the tagged versions of p now, oldest first.
func (w world) versions(p fakePkg) []int {
	var out []int
	for k := 0; ; k++ {
		if w.tagTime(p, k).After(w.now()) {
			return out
		}
		out = append(out, k)
	}
}

func version(k int) string { return fmt.Sprintf("1.%d.0", k) }

// failed: every seventh version's build fails.
func failed(k int) bool { return k%7 == 6 }

func (w world) age(p fakePkg, k int) time.Duration { return w.now().Sub(w.tagTime(p, k)) }

// published reports whether version k is in the registry now.
func (w world) published(p fakePkg, k int) bool {
	return !failed(k) && w.age(p, k) >= publishedAt
}

// running is the version a deployment target runs: the newest published one
// that has been out for deployedAt.
func (w world) running(p fakePkg) (int, bool) {
	vs := w.versions(p)
	for i := len(vs) - 1; i >= 0; i-- {
		k := vs[i]
		if (p.kind == site || w.published(p, k)) && w.age(p, k) >= deployedAt {
			return k, true
		}
	}
	return 0, false
}
