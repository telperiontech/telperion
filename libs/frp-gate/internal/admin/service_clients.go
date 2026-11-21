package admin

import (
	"context"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

// CreateClient adds a client, optionally into groups, and returns its token
// (shown once).
func (s *Service) CreateClient(ctx context.Context, name, note string, groups []string) (store.Client, string, error) {
	name, err := names.Label("client", name)
	if err != nil {
		return store.Client{}, "", inputError{err.Error()}
	}
	var groupIDs []int64
	for _, gname := range groups {
		if strings.TrimSpace(gname) == "" {
			continue
		}
		g, err := s.Store.GroupByName(ctx, strings.ToLower(strings.TrimSpace(gname)))
		if err != nil {
			return store.Client{}, "", notFoundAsInput(err, "group", gname)
		}
		groupIDs = append(groupIDs, g.ID)
	}
	tok := token.New(token.ClientPrefix)
	c, err := s.Store.CreateClient(ctx, name, token.Hash(tok), strings.TrimSpace(note))
	if err != nil {
		return c, "", err
	}
	for _, id := range groupIDs {
		if err := s.Store.AddMember(ctx, id, c.ID); err != nil {
			return c, tok, err
		}
	}
	return c, tok, nil
}

// Client returns a client by name.
func (s *Service) Client(ctx context.Context, name string) (store.Client, error) {
	return s.Store.ClientByName(ctx, strings.ToLower(name))
}

// RotateClientToken replaces a client's token and returns the new one.
func (s *Service) RotateClientToken(ctx context.Context, name string) (store.Client, string, error) {
	c, err := s.Client(ctx, name)
	if err != nil {
		return c, "", err
	}
	tok := token.New(token.ClientPrefix)
	return c, tok, s.Store.SetClientToken(ctx, c.ID, token.Hash(tok))
}

// SetClientDisabled disables or enables a client.
func (s *Service) SetClientDisabled(ctx context.Context, name string, disabled bool) error {
	c, err := s.Client(ctx, name)
	if err != nil {
		return err
	}
	return s.Store.SetClientDisabled(ctx, c.ID, disabled)
}

// DeleteClient removes a client.
func (s *Service) DeleteClient(ctx context.Context, name string) error {
	c, err := s.Client(ctx, name)
	if err != nil {
		return err
	}
	return s.Store.DeleteClient(ctx, c.ID)
}
