package coolify

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Deploy sets the application's image tag to version and starts a
// deployment. An application that already runs that tag is adopted (the ref
// has no id).
func (rt Runtime) Deploy(ctx context.Context, _ string, d catalog.Deploy, version string) (adapter.DeployRef, error) {
	app, err := rt.app(ctx, d)
	if err != nil {
		return adapter.DeployRef{}, err
	}
	if strings.TrimPrefix(app.ImageTag, "v") == version && appState(app) == model.OK {
		return adapter.DeployRef{}, nil
	}
	tag := version
	if strings.HasPrefix(app.ImageTag, "v") {
		tag = "v" + version // keep the application's tag style
	}
	if err := rt.call(ctx, d, http.MethodPatch, "/applications/"+d.Coolify.App,
		map[string]string{"docker_registry_image_tag": tag}, &struct{}{}); err != nil {
		return adapter.DeployRef{}, err
	}
	var res struct {
		Deployments []struct {
			DeploymentUUID string `json:"deployment_uuid"`
		} `json:"deployments"`
	}
	q := url.Values{"uuid": {d.Coolify.App}, "force": {"false"}}
	if err := rt.call(ctx, d, http.MethodGet, "/deploy?"+q.Encode(), nil, &res); err != nil {
		return adapter.DeployRef{}, err
	}
	if len(res.Deployments) == 0 || res.Deployments[0].DeploymentUUID == "" {
		return adapter.DeployRef{}, errors.New("coolify started no deployment")
	}
	return adapter.DeployRef{ID: res.Deployments[0].DeploymentUUID}, nil
}

// DeployStatus follows a deployment: queued and in_progress are pending,
// finished is ok, failed and cancelled are failed. An adopted deploy (no id)
// reports the application's state.
func (rt Runtime) DeployStatus(ctx context.Context, d catalog.Deploy, ref adapter.DeployRef) (model.State, string, error) {
	if ref.ID == "" {
		app, err := rt.app(ctx, d)
		if err != nil {
			return "", "", err
		}
		return appState(app), app.Status, nil
	}
	var dep struct {
		Status string `json:"status"`
	}
	if err := rt.call(ctx, d, http.MethodGet, "/deployments/"+url.PathEscape(ref.ID), nil, &dep); err != nil {
		return "", "", err
	}
	switch dep.Status {
	case "finished":
		return model.OK, dep.Status, nil
	case "failed", "cancelled-by-user", "cancelled":
		return model.Failed, dep.Status, nil
	}
	return model.Pending, dep.Status, nil
}
