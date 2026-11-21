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
	return s.Store.CreateZone(ctx, d)
}

// DeleteZone removes a zone without grants.
func (s *Service) DeleteZone(ctx context.Context, domain string) error {
	z, err := s.Store.ZoneByDomain(ctx, strings.ToLower(domain))
	if err != nil {
		return err
	}
	if err := s.Store.DeleteZone(ctx, z.ID); errors.Is(err, store.ErrInUse) {
		return badInput("zone %s still has grants; delete them first", z.Domain)
	} else if err != nil {
		return err
	}
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
