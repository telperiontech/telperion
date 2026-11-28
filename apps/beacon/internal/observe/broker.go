package observe

import (
	"slices"
	"sync"
)

// Notice names what changed: packages (observations, unreleased changes) and
// plan runs. It carries no state; whoever listens re-reads what it needs.
type Notice struct {
	Packages []string `json:"packages"`
	Runs     []int64  `json:"runs,omitempty"`
}

// PackagesNotice names packages, sorted and without duplicates.
func PackagesNotice(names []string) Notice {
	names = slices.Clone(names)
	slices.Sort(names)
	return Notice{Packages: slices.Compact(names)}
}

// Broker fans notices out to subscribers (the SSE streams, the plan runner).
// A slow subscriber misses notices instead of holding up the publisher;
// subscribers re-read the state on every notice anyway.
type Broker struct {
	mu   sync.Mutex
	subs map[chan Notice]struct{}
}

// Subscribe returns a channel of notices and a function that ends the
// subscription.
func (b *Broker) Subscribe() (<-chan Notice, func()) {
	ch := make(chan Notice, 8)
	b.mu.Lock()
	if b.subs == nil {
		b.subs = map[chan Notice]struct{}{}
	}
	b.subs[ch] = struct{}{}
	b.mu.Unlock()
	return ch, func() {
		b.mu.Lock()
		delete(b.subs, ch)
		b.mu.Unlock()
	}
}

// Publish sends a notice to every subscriber that has room.
func (b *Broker) Publish(n Notice) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for ch := range b.subs {
		select {
		case ch <- n:
		default:
		}
	}
}
