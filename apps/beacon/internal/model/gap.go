package model

import "time"

// Gap is a version stuck between two stages: From is ok, To is missing or
// failed. Its age runs from when From became ok.
type Gap struct {
	Version string    `json:"version"`
	From    Stage     `json:"from"`
	To      Stage     `json:"to"`
	State   State     `json:"state"` // of To: missing or failed
	Since   time.Time `json:"since"` // when From became ok
	Stuck   bool      `json:"stuck"` // failed, or older than the threshold for To
}

// StuckAfter is how long a stage may normally take after the previous one
// became ok before its gap counts as stuck.
var StuckAfter = map[Stage]time.Duration{
	Built:     10 * time.Minute, // a tag push starts CI within minutes
	Published: 45 * time.Minute, // CI builds and publishes
	Deployed:  24 * time.Hour,   // deployments are often by hand
}

// Gaps finds the gaps of one package. versions is newest first (from Cells).
// Versions older than the newest one that completed the chain are superseded
// and never reported: nobody needs an old version published once a newer one
// went through.
func Gaps(chain []Stage, versions []VersionCells, now time.Time) []Gap {
	if len(chain) < 2 {
		return nil
	}
	last := chain[len(chain)-1]
	var gaps []Gap
	for _, v := range versions {
		if v.Cells[last].State == OK {
			break
		}
		if g, ok := firstGap(chain, v, now); ok {
			gaps = append(gaps, g)
		}
	}
	return gaps
}

// firstGap is the earliest break in a version's chain, if any. A pending stage
// is progress, not a gap.
func firstGap(chain []Stage, v VersionCells, now time.Time) (Gap, bool) {
	for i := 0; i+1 < len(chain); i++ {
		from, to := v.Cells[chain[i]], v.Cells[chain[i+1]]
		if from.State != OK {
			return Gap{}, false
		}
		if to.State == Missing || to.State == Failed {
			since := from.Since
			if since.IsZero() {
				since = v.FirstSeen
			}
			return Gap{
				Version: v.Version, From: chain[i], To: chain[i+1], State: to.State, Since: since,
				Stuck: to.State == Failed || now.Sub(since) > StuckAfter[chain[i+1]],
			}, true
		}
	}
	return Gap{}, false
}
