package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"slices"
	"strconv"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

const (
	keyGitHub     = "catalog.github"
	keyCDEvents   = "catalog.cdevents"
	keyCatalogRev = "catalog.rev"
)

// LoadCatalog reads the stored configuration.
func (s *Store) LoadCatalog(ctx context.Context) (catalog.Catalog, error) {
	var c catalog.Catalog
	var gh catalog.GitHubApp
	found, err := s.setting(ctx, keyGitHub, &gh)
	if err != nil {
		return c, err
	}
	if found {
		c.GitHub = &gh
	}
	if _, err := s.setting(ctx, keyCDEvents, &c.CDEvents); err != nil {
		return c, err
	}
	if c.Targets, err = loadSpecs[catalog.Target](ctx, s.q, "SELECT spec FROM targets ORDER BY name"); err != nil {
		return c, err
	}
	if c.Projects, err = loadSpecs[catalog.Project](ctx, s.q, "SELECT spec FROM projects ORDER BY name"); err != nil {
		return c, err
	}
	if c.Packages, err = loadSpecs[catalog.Package](ctx, s.q, "SELECT spec FROM packages ORDER BY name"); err != nil {
		return c, err
	}
	c.Recipes, err = s.recipes(ctx)
	return c, err
}

// setting decodes the JSON setting key into out; false if it is not set.
func (s *Store) setting(ctx context.Context, key string, out any) (bool, error) {
	var b []byte
	err := s.q.QueryRowContext(ctx, "SELECT value FROM settings WHERE key = ?", key).Scan(&b)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, json.Unmarshal(b, out)
}

func loadSpecs[T any](ctx context.Context, q querier, query string) ([]T, error) {
	rows, err := q.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []T{}
	for rows.Next() {
		var spec []byte
		var v T
		if err := rows.Scan(&spec); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(spec, &v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// SaveCatalog replaces the managed configuration with c, forgets the
// observations of packages that are gone, and bumps the catalog revision so a
// running server reloads. Call it inside WithTx.
func (s *Store) SaveCatalog(ctx context.Context, c catalog.Catalog) error {
	gone, err := s.removedPackages(ctx, c)
	if err != nil {
		return err
	}
	for _, stmt := range []string{
		"DELETE FROM packages WHERE managed = 1", "DELETE FROM projects WHERE managed = 1",
		"DELETE FROM targets WHERE managed = 1",
		"DELETE FROM settings WHERE key IN ('" + keyGitHub + "', '" + keyCDEvents + "')",
	} {
		if _, err := s.q.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	if c.GitHub != nil {
		if err := s.putJSON(ctx, "INSERT INTO settings (key, value) VALUES (?, ?)", keyGitHub, c.GitHub); err != nil {
			return err
		}
	}
	if len(c.CDEvents) > 0 {
		if err := s.putJSON(ctx, "INSERT INTO settings (key, value) VALUES (?, ?)", keyCDEvents, c.CDEvents); err != nil {
			return err
		}
	}
	for _, t := range c.Targets {
		if err := s.putJSON(ctx, "INSERT INTO targets (name, spec) VALUES (?, ?)", t.Name, t); err != nil {
			return err
		}
	}
	for _, p := range c.Projects {
		if err := s.putJSON(ctx, "INSERT INTO projects (name, spec) VALUES (?, ?)", p.Name, p); err != nil {
			return err
		}
	}
	for _, p := range c.Packages {
		spec, err := json.Marshal(p)
		if err != nil {
			return err
		}
		if _, err := s.q.ExecContext(ctx, "INSERT INTO packages (name, project, spec) VALUES (?, ?, ?)", p.Name, p.Project, spec); err != nil {
			return err
		}
	}
	if err := s.saveManagedRecipes(ctx, c.Recipes); err != nil {
		return err
	}
	for _, name := range gone {
		for _, table := range []string{"versions", "stage_states", "unreleased"} {
			if _, err := s.q.ExecContext(ctx, "DELETE FROM "+table+" WHERE package = ?", name); err != nil {
				return err
			}
		}
	}
	_, err = s.q.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES (?, '1')
		ON CONFLICT (key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`, keyCatalogRev)
	return err
}

func (s *Store) putJSON(ctx context.Context, query, key string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = s.q.ExecContext(ctx, query, key, b)
	return err
}

func (s *Store) removedPackages(ctx context.Context, c catalog.Catalog) ([]string, error) {
	cur, err := loadSpecs[catalog.Package](ctx, s.q, "SELECT spec FROM packages")
	if err != nil {
		return nil, err
	}
	var gone []string
	for _, p := range cur {
		if !slices.ContainsFunc(c.Packages, func(n catalog.Package) bool { return n.Name == p.Name }) {
			gone = append(gone, p.Name)
		}
	}
	return gone, nil
}

// CatalogRev changes whenever SaveCatalog runs (also from another process,
// e.g. `beacon apply`), so the server knows when to reload.
func (s *Store) CatalogRev(ctx context.Context) (int64, error) {
	var v []byte
	err := s.q.QueryRowContext(ctx, "SELECT value FROM settings WHERE key = ?", keyCatalogRev).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(string(v), 10, 64)
}
