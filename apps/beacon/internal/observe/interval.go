package observe

import (
	"math/rand/v2"
	"time"
)

// Options tune the schedule. The defaults are DESIGN.md's.
type Options struct {
	Hot     time.Duration // a stage of the job's packages is pending
	Warm    time.Duration // a package changed within WarmFor
	Cold    time.Duration // everything else; also the longest error backoff
	WarmFor time.Duration
	Workers int // concurrent polls
	Reload  time.Duration
	Timeout time.Duration // per poll
}

// DefaultOptions: hot 15 s, warm 2 min, cold 15 min, 4 workers.
func DefaultOptions() Options {
	return Options{
		Hot: 15 * time.Second, Warm: 2 * time.Minute, Cold: 15 * time.Minute, WarmFor: 30 * time.Minute,
		Workers: 4, Reload: 30 * time.Second, Timeout: time.Minute,
	}
}

// Tiers.
const (
	TierHot     = "hot"
	TierWarm    = "warm"
	TierCold    = "cold"
	TierBackoff = "backoff"
)

// tier says how closely a job is watched. pending and changed are per package.
func (o Options) tier(e *entry, pending map[string]bool, changed map[string]time.Time, now time.Time) (string, time.Duration) {
	if e.failures > 0 {
		d := o.Hot << min(e.failures-1, 16)
		return TierBackoff, min(d, o.Cold)
	}
	for _, p := range e.job.Packages {
		if pending[p] {
			return TierHot, o.Hot
		}
	}
	for _, p := range e.job.Packages {
		if t, ok := changed[p]; ok && now.Sub(t) < o.WarmFor {
			return TierWarm, o.Warm
		}
	}
	return TierCold, o.Cold
}

// nextPoll applies the rate-limit budget of the job's host and ±10% jitter,
// so jobs started together drift apart.
func nextPoll(now time.Time, d time.Duration, stretch float64, notBefore time.Time) time.Time {
	d = time.Duration(float64(d) * stretch * (0.9 + 0.2*rand.Float64()))
	next := now.Add(d)
	if notBefore.After(next) {
		return notBefore
	}
	return next
}
