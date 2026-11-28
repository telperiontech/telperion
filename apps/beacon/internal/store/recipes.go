package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Errors of the recipe writes from the UI.
var (
	ErrNoRecipe = errors.New("no such recipe")
	ErrManaged  = errors.New("the recipe comes from the config file; change it there")
)

// recipes reads every recipe, from the file (managed) and from the UI.
func (s *Store) recipes(ctx context.Context) ([]model.Plan, error) {
	rows, err := s.q.QueryContext(ctx, "SELECT spec, managed FROM recipes ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Plan
	for rows.Next() {
		var spec []byte
		var p model.Plan
		if err := rows.Scan(&spec, &p.Managed); err != nil {
			return nil, err
		}
		managed := p.Managed
		if err := json.Unmarshal(spec, &p); err != nil {
			return nil, err
		}
		p.Managed = managed
		out = append(out, p)
	}
	return out, rows.Err()
}

// saveManagedRecipes replaces the file's recipes; a file recipe replaces a
// UI recipe of the same name. Part of SaveCatalog.
func (s *Store) saveManagedRecipes(ctx context.Context, plans []model.Plan) error {
	if _, err := s.q.ExecContext(ctx, "DELETE FROM recipes WHERE managed = 1"); err != nil {
		return err
	}
	for _, p := range plans {
		if !p.Managed {
			continue // a UI recipe read back with the catalog stays as it is
		}
		spec, err := json.Marshal(p)
		if err != nil {
			return err
		}
		if _, err := s.q.ExecContext(ctx, "INSERT OR REPLACE INTO recipes (name, spec, managed) VALUES (?, ?, 1)", p.Name, spec); err != nil {
			return err
		}
	}
	return nil
}

// SaveRecipe stores a recipe made in the UI (unmanaged), replacing an
// unmanaged one of the same name. It refuses to replace a file recipe.
func (s *Store) SaveRecipe(ctx context.Context, p model.Plan) error {
	return s.WithTx(ctx, func(tx *Store) error {
		var managed bool
		err := tx.q.QueryRowContext(ctx, "SELECT managed FROM recipes WHERE name = ?", p.Name).Scan(&managed)
		switch {
		case err == nil && managed:
			return ErrManaged
		case err != nil && !errors.Is(err, sql.ErrNoRows):
			return err
		}
		p.Managed = false
		spec, err := json.Marshal(p)
		if err != nil {
			return err
		}
		_, err = tx.q.ExecContext(ctx, "INSERT OR REPLACE INTO recipes (name, spec, managed) VALUES (?, ?, 0)", p.Name, spec)
		return err
	})
}

// DeleteRecipe removes a recipe made in the UI.
func (s *Store) DeleteRecipe(ctx context.Context, name string) error {
	return s.WithTx(ctx, func(tx *Store) error {
		var managed bool
		err := tx.q.QueryRowContext(ctx, "SELECT managed FROM recipes WHERE name = ?", name).Scan(&managed)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return ErrNoRecipe
		case err != nil:
			return err
		case managed:
			return ErrManaged
		}
		_, err = tx.q.ExecContext(ctx, "DELETE FROM recipes WHERE name = ?", name)
		return err
	})
}
