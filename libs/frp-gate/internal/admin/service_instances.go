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
	var in store.Instance
	err = s.Store.WithTx(ctx, func(tx *store.Store) error {
		var err error
		if in, err = tx.CreateInstance(ctx, name, token.Hash(key), strings.TrimSpace(serverAddr)); err != nil {
			return err
		}
		return tx.SetInstanceZones(ctx, in.ID, ids)
	})
	if err != nil {
		return store.Instance{}, "", err
	}
	in.ZoneIDs = ids
	s.record(ctx, "instance.create", in.Name, strings.Join(zones, ","))
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
	if in.Managed {
		return ManagedError{Kind: "server", Name: in.Name, What: "given other zones"}
	}
	ids, err := s.zoneIDs(ctx, zones)
	if err != nil {
		return err
	}
	if err := s.Store.SetInstanceZones(ctx, in.ID, ids); err != nil {
		return err
	}
	s.record(ctx, "instance.zones", in.Name, strings.Join(zones, ","))
	return nil
}

// RotateInstanceKey replaces an frps plugin key and returns the new one. A
// key declared in the config file is not rotated here.
func (s *Service) RotateInstanceKey(ctx context.Context, name string) (store.Instance, string, error) {
	in, err := s.Instance(ctx, name)
	if err != nil {
		return in, "", err
	}
	if in.SecretManaged {
		return in, "", ManagedError{Kind: "the key of server", Name: in.Name, What: "rotated"}
	}
	key := token.New(token.InstancePrefix)
	if err := s.Store.SetInstanceKey(ctx, in.ID, token.Hash(key)); err != nil {
		return in, "", err
	}
	s.record(ctx, "instance.rotate", in.Name, "key rotated")
	return in, key, nil
}

// DeleteInstance removes an frps.
func (s *Service) DeleteInstance(ctx context.Context, name string) error {
	in, err := s.Instance(ctx, name)
	if err != nil {
		return err
	}
	if in.Managed {
		return ManagedError{Kind: "server", Name: in.Name, What: "deleted"}
	}
	if err := s.Store.DeleteInstance(ctx, in.ID); err != nil {
		return err
	}
	s.record(ctx, "instance.delete", in.Name, "")
	return nil
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
		if _, err = s.Store.CreateInstance(ctx, name, token.Hash(key), serverAddr); err == nil {
			s.record(ctx, "instance.create", name, "from FRP_GATE_INSTANCE_KEY")
		}
		return err
	}
	if err != nil {
		return err
	}
	if err := s.Store.SetInstanceKey(ctx, in.ID, token.Hash(key)); err != nil {
		return err
	}
	s.record(ctx, "instance.rotate", name, "key set from FRP_GATE_INSTANCE_KEY")
	return nil
}
