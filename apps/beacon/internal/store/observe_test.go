package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

func openTest(t *testing.T) (*Store, *time.Time) {
	t.Helper()
	st, err := Open(context.Background(), ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	st.SetClock(func() time.Time { return now })
	return st, &now
}

func TestObserveTransitions(t *testing.T) {
	ctx := context.Background()
	st, now := openTest(t)
	built := func(state model.State) model.Obs {
		return model.Obs{Package: "p", Version: "1.0.0", Stage: model.Built, State: state, URL: "https://ci.example.com/1"}
	}

	cs, err := st.Observe(ctx, []model.Obs{built(model.Pending)})
	if err != nil || len(cs) != 1 || cs[0].From != model.Missing || cs[0].To != model.Pending {
		t.Fatalf("first = %+v %v", cs, err)
	}
	if cs, _ := st.Observe(ctx, []model.Obs{built(model.Pending)}); len(cs) != 0 {
		t.Errorf("a repeated observation changed %+v", cs)
	}
	*now = now.Add(time.Minute)
	if cs, _ := st.Observe(ctx, []model.Obs{built(model.OK)}); len(cs) != 1 || cs[0].From != model.Pending {
		t.Errorf("pending → ok = %+v", cs)
	}
	states, _ := st.States(ctx, "p")
	row := states["p"].Rows[0]
	if row.State != model.OK || !row.Since.Equal(*now) {
		t.Errorf("row = %+v", row)
	}
	if evs, _ := st.Events(ctx, "p", 0, 10); len(evs) != 2 || evs[0].State != model.OK {
		t.Errorf("events = %+v", evs)
	}
}

func TestObserveExclusive(t *testing.T) {
	ctx := context.Background()
	st, _ := openTest(t)
	running := func(v string) model.Obs {
		return model.Obs{Package: "svc", Version: v, Stage: model.Deployed, Target: "main", State: model.OK, Exclusive: true}
	}
	if _, err := st.Observe(ctx, []model.Obs{running("1.0.0")}); err != nil {
		t.Fatal(err)
	}
	cs, err := st.Observe(ctx, []model.Obs{running("1.1.0")})
	if err != nil || len(cs) != 2 {
		t.Fatalf("roll forward = %+v %v", cs, err)
	}
	states, _ := st.States(ctx, "svc")
	for _, r := range states["svc"].Rows {
		want := map[string]model.State{"1.0.0": model.Missing, "1.1.0": model.OK}[r.Version]
		if r.State != want {
			t.Errorf("%s = %s, want %s", r.Version, r.State, want)
		}
	}
}

func TestBackupAndSecret(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	st, err := Open(ctx, filepath.Join(dir, "b.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	a, _ := st.Secret(ctx, "k", 32)
	b, _ := st.Secret(ctx, "k", 32)
	if len(a) != 32 || string(a) != string(b) {
		t.Error("the secret is not stable")
	}
	if err := st.Backup(ctx, filepath.Join(dir, "copy.db"), nil); err != nil {
		t.Fatal(err)
	}
}
