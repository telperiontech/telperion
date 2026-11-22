package admin

import (
	"context"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

// CreateClient adds a client, optionally into groups, and returns its token
// (shown once). Groups managed by the config file own their members, so a
// client cannot be put into one here.
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
		if g.Managed {
			return store.Client{}, "", ManagedError{Kind: "group", Name: g.Name, What: "given new members"}
		}
		groupIDs = append(groupIDs, g.ID)
	}
	tok := token.New(token.ClientPrefix)
	var c store.Client
	err = s.Store.WithTx(ctx, func(tx *store.Store) error {
		var err error
		if c, err = tx.CreateClient(ctx, name, token.Hash(tok), strings.TrimSpace(note)); err != nil {
			return err
		}
		for _, id := range groupIDs {
			if err := tx.AddMember(ctx, id, c.ID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return store.Client{}, "", err
	}
	s.record(ctx, "client.create", c.Name, strings.Join(groups, ","))
	return c, tok, nil
}

// Client returns a client by name.
func (s *Service) Client(ctx context.Context, name string) (store.Client, error) {
	return s.Store.ClientByName(ctx, strings.ToLower(name))
}

// RotateClientToken replaces a client's token and returns the new one. A
// token declared in the config file is not rotated here.
func (s *Service) RotateClientToken(ctx context.Context, name string) (store.Client, string, error) {
	c, err := s.Client(ctx, name)
	if err != nil {
		return c, "", err
	}
	if c.SecretManaged {
		return c, "", ManagedError{Kind: "the token of client", Name: c.Name, What: "rotated"}
	}
	tok := token.New(token.ClientPrefix)
	if err := s.Store.SetClientToken(ctx, c.ID, token.Hash(tok)); err != nil {
		return c, "", err
	}
	s.record(ctx, "client.rotate", c.Name, "token rotated")
	return c, tok, nil
}

// SetClientDisabled disables or enables a client. This works for managed
// clients too: it is the emergency switch. Apply only changes it back if
// the file sets "disabled" explicitly.
func (s *Service) SetClientDisabled(ctx context.Context, name string, disabled bool) error {
	c, err := s.Client(ctx, name)
	if err != nil {
		return err
	}
	if err := s.Store.SetClientDisabled(ctx, c.ID, disabled); err != nil {
		return err
	}
	action := "client.enable"
	if disabled {
		action = "client.disable"
	}
	s.record(ctx, action, c.Name, "")
	return nil
}

// DeleteClient removes a client.
func (s *Service) DeleteClient(ctx context.Context, name string) error {
	c, err := s.Client(ctx, name)
	if err != nil {
		return err
	}
	if c.Managed {
		return ManagedError{Kind: "client", Name: c.Name, What: "deleted"}
	}
	if err := s.Store.DeleteClient(ctx, c.ID); err != nil {
		return err
	}
	s.record(ctx, "client.delete", c.Name, "")
	return nil
}
