package observe

import (
	"sync"

	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// Broker fans changes out to subscribers (the SSE streams). A slow subscriber
// misses batches instead of holding up the loop; clients re-read the state
// on every notification anyway.
type Broker struct {
	mu   sync.Mutex
	subs map[chan []store.Change]struct{}
}

// Subscribe returns a channel of change batches and a function that ends the
// subscription.
func (b *Broker) Subscribe() (<-chan []store.Change, func()) {
	ch := make(chan []store.Change, 8)
	b.mu.Lock()
	if b.subs == nil {
		b.subs = map[chan []store.Change]struct{}{}
	}
	b.subs[ch] = struct{}{}
	b.mu.Unlock()
	return ch, func() {
		b.mu.Lock()
		delete(b.subs, ch)
		b.mu.Unlock()
	}
}

// Publish sends a batch to every subscriber that has room.
func (b *Broker) Publish(changes []store.Change) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for ch := range b.subs {
		select {
		case ch <- changes:
		default:
		}
	}
}
