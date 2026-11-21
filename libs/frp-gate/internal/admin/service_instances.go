package admin

import (
	"context"
	"errors"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

// CreateInstance adds an frps and returns its plugin key (shown once).
func (s *Service) CreateInstance(ctx context.Context, name, serverAddr string, zones []string) (store.Instance, string, error) {
	name, err := names.Label("instance", name)
	if err != nil {
		return store.Instance{}, "", inputError{err.Error()}
	}
	ids, err := s.zoneIDs(ctx, zones)
	if err != nil {
		return store.Instance{}, "", err
	}
	key := token.New(token.InstancePrefix)
	in, err := s.Store.CreateInstance(ctx, name, token.Hash(key), strings.TrimSpace(serverAddr))
	if err != nil {
		return in, "", err
	}
	if err := s.Store.SetInstanceZones(ctx, in.ID, ids); err != nil {
		return in, "", err
	}
	in.ZoneIDs = ids
	return in, key, nil
}

// Instance returns an frps by name.
func (s *Service) Instance(ctx context.Context, name string) (store.Instance, error) {
	return s.Store.InstanceByName(ctx, strings.ToLower(name))
}

// SetInstanceZones replaces the zones an frps serves.
func (s *Service) SetInstanceZones(ctx context.Context, name string, zones []string) error {
	in, err := s.Instance(ctx, name)
	if err != nil {
		return err
	}
	ids, err := s.zoneIDs(ctx, zones)
	if err != nil {
		return err
	}
	return s.Store.SetInstanceZones(ctx, in.ID, ids)
}

// RotateInstanceKey replaces an frps plugin key and returns the new one.
func (s *Service) RotateInstanceKey(ctx context.Context, name string) (store.Instance, string, error) {
	in, err := s.Instance(ctx, name)
	if err != nil {
		return in, "", err
	}
	key := token.New(token.InstancePrefix)
	return in, key, s.Store.SetInstanceKey(ctx, in.ID, token.Hash(key))
}

// DeleteInstance removes an frps.
func (s *Service) DeleteInstance(ctx context.Context, name string) error {
	in, err := s.Instance(ctx, name)
	if err != nil {
		return err
	}
	return s.Store.DeleteInstance(ctx, in.ID)
}

// EnsureInstance makes sure an frps with this name uses this key (from the
// environment). It is how the compose example works without a UI step.
func (s *Service) EnsureInstance(ctx context.Context, name, key, serverAddr string) error {
	name, err := names.Label("instance", name)
	if err != nil {
		return err
	}
	if _, err := s.Store.InstanceByKeyHash(ctx, token.Hash(key)); err == nil {
		return nil
	}
	in, err := s.Store.InstanceByName(ctx, name)
	if errors.Is(err, store.ErrNotFound) {
		_, err = s.Store.CreateInstance(ctx, name, token.Hash(key), serverAddr)
		return err
	}
	if err != nil {
		return err
	}
	return s.Store.SetInstanceKey(ctx, in.ID, token.Hash(key))
}
