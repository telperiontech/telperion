package audit

import (
	"context"
	"testing"
)

func TestActor(t *testing.T) {
	if got := From(context.Background()); got.Source != "unknown" {
		t.Errorf("empty context = %+v", got)
	}
	a := Actor{Source: "ui", Who: "192.0.2.1"}
	if got := From(WithActor(context.Background(), a)); got != a {
		t.Errorf("got %+v", got)
	}
}
