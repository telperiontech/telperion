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
	g, err := s.Store.CreateGroup(ctx, name)
	if err == nil {
		s.record(ctx, "group.create", g.Name, "")
	}
	return g, err
}

// DeleteGroup removes a group.
func (s *Service) DeleteGroup(ctx context.Context, name string) error {
	g, err := s.Store.GroupByName(ctx, strings.ToLower(name))
	if err != nil {
		return err
	}
	if g.Managed {
		return ManagedError{Kind: "group", Name: g.Name, What: "deleted"}
	}
	if err := s.Store.DeleteGroup(ctx, g.ID); err != nil {
		return err
	}
	s.record(ctx, "group.delete", g.Name, "")
	return nil
}

// SetMember adds a client to a group or removes it. The members of a group
// managed by the config file are set by the file only.
func (s *Service) SetMember(ctx context.Context, group, client string, member bool) error {
	g, err := s.Store.GroupByName(ctx, strings.ToLower(group))
	if err != nil {
		return err
	}
	if g.Managed {
		return ManagedError{Kind: "group", Name: g.Name, What: "given or stripped of members"}
	}
	c, err := s.Client(ctx, client)
	if err != nil {
		return err
	}
	if member {
		err = s.Store.AddMember(ctx, g.ID, c.ID)
	} else {
		err = s.Store.RemoveMember(ctx, g.ID, c.ID)
	}
	if err != nil {
		return err
	}
	action := "group.member.remove"
	if member {
		action = "group.member.add"
	}
	s.record(ctx, action, g.Name, c.Name)
	return nil
}
