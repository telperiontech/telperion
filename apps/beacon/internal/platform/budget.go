package platform

import (
	"net/http"
	"strconv"
	"sync"
	"time"
)

// Budget tracks a host's rate limit from X-RateLimit-Limit, -Remaining and
// -Reset (GitHub's headers; hosts without them never stretch).
type Budget struct {
	mu        sync.Mutex
	limit     int
	remaining int
	reset     time.Time
	known     bool
}

func (b *Budget) update(h http.Header) {
	limit, errL := strconv.Atoi(h.Get("X-RateLimit-Limit"))
	remaining, errR := strconv.Atoi(h.Get("X-RateLimit-Remaining"))
	reset, errS := strconv.ParseInt(h.Get("X-RateLimit-Reset"), 10, 64)
	if errL != nil || errR != nil || errS != nil || limit <= 0 {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.limit, b.remaining, b.reset, b.known = limit, remaining, time.Unix(reset, 0), true
}

// Stretch is the factor for poll intervals on this host: 1 with plenty left,
// growing as the budget runs low, so polling slows down before the limit is
// hit. NotBefore is when polling may resume after the budget ran out (zero
// otherwise).
func (b *Budget) Stretch(now time.Time) (factor float64, notBefore time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.known || now.After(b.reset) {
		return 1, time.Time{}
	}
	left := float64(b.remaining) / float64(b.limit)
	switch {
	case b.remaining <= 0:
		return 1, b.reset
	case left < 0.05:
		return 8, time.Time{}
	case left < 0.15:
		return 4, time.Time{}
	case left < 0.30:
		return 2, time.Time{}
	}
	return 1, time.Time{}
}
