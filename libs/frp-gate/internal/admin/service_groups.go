package admin

import (
	"context"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// CreateGroup adds a group.
func (s *Service) CreateGroup(ctx context.Context, name string) (store.Group, error) {
	name, err := names.Label("group", name)
	if err != nil {
		return store.Group{}, inputError{err.Error()}
	}
	return s.Store.CreateGroup(ctx, name)
}

// DeleteGroup removes a group.
func (s *Service) DeleteGroup(ctx context.Context, name string) error {
	g, err := s.Store.GroupByName(ctx, strings.ToLower(name))
	if err != nil {
		return err
	}
	return s.Store.DeleteGroup(ctx, g.ID)
}

// SetMember adds a client to a group or removes it.
func (s *Service) SetMember(ctx context.Context, group, client string, member bool) error {
	g, err := s.Store.GroupByName(ctx, strings.ToLower(group))
	if err != nil {
		return err
	}
	c, err := s.Client(ctx, client)
	if err != nil {
		return err
	}
	if member {
		return s.Store.AddMember(ctx, g.ID, c.ID)
	}
	return s.Store.RemoveMember(ctx, g.ID, c.ID)
}
