// Package coolify reads which image tag an application runs on a Coolify v4
// instance (GET /api/v1/applications/{uuid}) and deploys a version: set the
// image tag, start a deployment, follow its status.
//
// To verify against the Coolify version in use: the endpoints and field names
// (docker_registry_image_tag, status "running:healthy", /deploy?uuid=,
// /deployments/{uuid}) follow the v4 API documentation and have not been
// checked against a live instance yet.
package coolify

import (
	"bytes"
	"context"
	"encoding/json"
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

// Runtime implements adapter.Runtime and adapter.Deployer for the targets of
// a catalog.
type Runtime struct {
	Client  *platform.Client
	Targets func(name string) (catalog.Target, bool)
}

var (
	_ adapter.Runtime  = Runtime{}
	_ adapter.Deployer = Runtime{}
)

type application struct {
	Status   string `json:"status"`                    // e.g. running:healthy, exited:unhealthy
	ImageTag string `json:"docker_registry_image_tag"` // the deployed image tag
}

// Running returns the image tag the application runs as the deployed version.
func (rt Runtime) Running(ctx context.Context, pkg string, d catalog.Deploy) (model.Obs, error) {
	app, err := rt.app(ctx, d)
	if err != nil {
		return model.Obs{}, err
	}
	version := strings.TrimPrefix(app.ImageTag, "v")
	if version == "" {
		return model.Obs{}, errors.New("the application reports no image tag (is it a Docker image application?)")
	}
	return model.Obs{
		Package: pkg, Version: version, Stage: model.Deployed, Target: d.Target, State: appState(app),
		Detail: app.Status, Exclusive: true,
	}, nil
}

func appState(app application) model.State {
	if strings.HasPrefix(app.Status, "running") {
		return model.OK
	}
	return model.Failed
}

func (rt Runtime) app(ctx context.Context, d catalog.Deploy) (application, error) {
	var app application
	err := rt.call(ctx, d, http.MethodGet, "/applications/"+d.Coolify.App, nil, &app)
	return app, err
}

// call makes an API request on the deploy's target.
func (rt Runtime) call(ctx context.Context, d catalog.Deploy, method, path string, body, out any) error {
	t, ok := rt.Targets(d.Target)
	if !ok || t.Coolify == nil || d.Coolify == nil {
		return fmt.Errorf("target %q is not a Coolify target", d.Target)
	}
	tok, err := secret.Value(t.Coolify.Token)
	if err != nil {
		return err
	}
	h := http.Header{}
	h.Set("Authorization", "Bearer "+tok)
	r := platform.Request{Method: method, URL: t.Coolify.URL + "/api/v1" + path, Header: h}
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		r.Body = bytes.NewReader(b)
		h.Set("Content-Type", "application/json")
	}
	return rt.Client.JSON(ctx, r, out)
}
