package oci

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
)

var challengeParam = regexp.MustCompile(`(\w+)="([^"]*)"`)

// fetchToken follows a Bearer challenge (realm, service, scope) to the
// registry's token endpoint, with basic auth when credentials are configured
// and anonymously otherwise (public images).
func (r *registry) fetchToken(ctx context.Context, challenge string) (string, error) {
	scheme, params, _ := strings.Cut(challenge, " ")
	if !strings.EqualFold(scheme, "Bearer") {
		return "", errors.New("the registry did not offer a bearer token challenge")
	}
	p := map[string]string{}
	for _, m := range challengeParam.FindAllStringSubmatch(params, -1) {
		p[strings.ToLower(m[1])] = m[2]
	}
	if p["realm"] == "" {
		return "", errors.New("the token challenge has no realm")
	}
	q := url.Values{}
	if p["service"] != "" {
		q.Set("service", p["service"])
	}
	q.Set("scope", or(p["scope"], "repository:"+r.o.Name+":pull"))

	h := http.Header{}
	pass, err := secret.Value(r.o.Token)
	if err != nil {
		return "", err
	}
	if pass != "" {
		h.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(or(r.o.User, "token")+":"+pass)))
	}
	var tok struct {
		Token       string `json:"token"`
		AccessToken string `json:"access_token"`
	}
	if err := r.client.JSON(ctx, platform.Request{URL: p["realm"] + "?" + q.Encode(), Header: h}, &tok); err != nil {
		return "", err
	}
	if t := or(tok.Token, tok.AccessToken); t != "" {
		return t, nil
	}
	return "", errors.New("the token endpoint returned no token")
}

func asStatus(err error, target **platform.StatusError) bool {
	return err != nil && errors.As(err, target)
}

func or(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
