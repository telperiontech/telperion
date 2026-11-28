package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// pingEvery keeps proxies from closing an idle stream.
const pingEvery = 25 * time.Second

// stream is the server-sent event stream the UI keeps open: one message per
// batch of changes, {"packages": [...]} naming the packages that changed. The
// UI re-reads what it shows; the stream carries no state of its own.
func (s server) stream(w http.ResponseWriter, r *http.Request) {
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{}) // the listener's write timeout does not apply
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-store")
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "retry: 3000\n\n")
	if err := rc.Flush(); err != nil {
		return
	}

	changes, cancel := s.Broker.Subscribe()
	defer cancel()
	ping := time.NewTicker(pingEvery)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case cs := <-changes:
			b, _ := json.Marshal(map[string][]string{"packages": packagesOf(cs)})
			fmt.Fprintf(w, "data: %s\n\n", b)
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
		}
		if err := rc.Flush(); err != nil {
			return
		}
	}
}

func packagesOf(cs []store.Change) []string {
	names := make([]string, 0, len(cs))
	for _, c := range cs {
		names = append(names, c.Package)
	}
	slices.Sort(names)
	return slices.Compact(names)
}
