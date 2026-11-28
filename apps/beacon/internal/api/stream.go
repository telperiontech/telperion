package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// pingEvery keeps proxies from closing an idle stream.
const pingEvery = 25 * time.Second

// stream is the server-sent event stream the UI keeps open: one message per
// notice, {"packages": [...], "runs": [...]} naming the packages and plan runs
// that changed. The UI re-reads what it shows; the stream carries no state of
// its own.
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

	notices, cancel := s.Broker.Subscribe()
	defer cancel()
	ping := time.NewTicker(pingEvery)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case n := <-notices:
			if n.Packages == nil {
				n.Packages = []string{}
			}
			b, _ := json.Marshal(n)
			fmt.Fprintf(w, "data: %s\n\n", b)
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
		}
		if err := rc.Flush(); err != nil {
			return
		}
	}
}
