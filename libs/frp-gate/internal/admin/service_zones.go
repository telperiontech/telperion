package admin

import (
	"context"
	"errors"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// CreateZone adds a zone.
func (s *Service) CreateZone(ctx context.Context, domain string) (store.Zone, error) {
	d, err := names.Domain(domain, false)
	if err != nil {
		return store.Zone{}, inputError{err.Error()}
	}
	z, err := s.Store.CreateZone(ctx, d)
	if err == nil {
		s.record(ctx, "zone.create", z.Domain, "")
	}
	return z, err
}

// DeleteZone removes a zone without grants.
func (s *Service) DeleteZone(ctx context.Context, domain string) error {
	z, err := s.Store.ZoneByDomain(ctx, strings.ToLower(domain))
	if err != nil {
		return err
	}
	if z.Managed {
		return ManagedError{Kind: "zone", Name: z.Domain, What: "deleted"}
	}
	if err := s.Store.DeleteZone(ctx, z.ID); errors.Is(err, store.ErrInUse) {
		return badInput("zone %s still has grants; delete them first", z.Domain)
	} else if err != nil {
		return err
	}
	s.record(ctx, "zone.delete", z.Domain, "")
	return nil
}

func (s *Service) zoneIDs(ctx context.Context, domains []string) ([]int64, error) {
	ids := []int64{}
	for _, d := range domains {
		if strings.TrimSpace(d) == "" {
			continue
		}
		z, err := s.Store.ZoneByDomain(ctx, strings.ToLower(strings.TrimSpace(d)))
		if errors.Is(err, store.ErrNotFound) {
			return nil, badInput("unknown zone %q", d)
		}
		if err != nil {
			return nil, err
		}
		ids = append(ids, z.ID)
	}
	return ids, nil
}
