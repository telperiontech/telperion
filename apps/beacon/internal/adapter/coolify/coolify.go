// Package coolify reads which image tag an application runs on a Coolify v4
// instance (GET /api/v1/applications/{uuid}). Read side only; deploying comes
// with Phase 2.
//
// To verify against the Coolify version in use: the field names below
// (docker_registry_image_tag, status "running:healthy") follow the v4 API
// documentation and have not been checked against a live instance yet.
package coolify

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
)

// Runtime implements adapter.Runtime for the targets of a catalog.
type Runtime struct {
	Client  *platform.Client
	Targets func(name string) (catalog.Target, bool)
}

var _ adapter.Runtime = Runtime{}

type application struct {
	Status   string `json:"status"`                    // e.g. running:healthy, exited:unhealthy
	ImageTag string `json:"docker_registry_image_tag"` // the deployed image tag
}

// Running returns the image tag the application runs as the deployed version.
func (rt Runtime) Running(ctx context.Context, pkg string, d catalog.Deploy) (model.Obs, error) {
	t, ok := rt.Targets(d.Target)
	if !ok || t.Coolify == nil || d.Coolify == nil {
		return model.Obs{}, fmt.Errorf("target %q is not a Coolify target", d.Target)
	}
	tok, err := secret.Value(t.Coolify.Token)
	if err != nil {
		return model.Obs{}, err
	}
	h := http.Header{}
	h.Set("Authorization", "Bearer "+tok)
	var app application
	u := t.Coolify.URL + "/api/v1/applications/" + d.Coolify.App
	if err := rt.Client.JSON(ctx, platform.Request{URL: u, Header: h}, &app); err != nil {
		return model.Obs{}, err
	}
	version := strings.TrimPrefix(app.ImageTag, "v")
	if version == "" {
		return model.Obs{}, errors.New("the application reports no image tag (is it a Docker image application?)")
	}
	state := model.OK
	if !strings.HasPrefix(app.Status, "running") {
		state = model.Failed
	}
	return model.Obs{
		Package: pkg, Version: version, Stage: model.Deployed, Target: d.Target, State: state,
		Detail: app.Status, Exclusive: true,
	}, nil
}
