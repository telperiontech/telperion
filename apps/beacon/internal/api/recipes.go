package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/telperiontech/telperion/apps/beacon/internal/declare"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

// recipes lists the saved plans: the file's (managed) and the UI's.
func (s server) recipes(w http.ResponseWriter, r *http.Request) {
	c, err := s.Store.LoadCatalog(r.Context())
	out := c.Recipes
	if out == nil {
		out = []model.Plan{}
	}
	s.respond(w, out, err)
}

// saveRecipe stores a plan from the plan builder as a UI recipe. The plan is
// checked against the catalog first (422 with the problems).
func (s server) saveRecipe(w http.ResponseWriter, r *http.Request) {
	var p model.Plan
	if !readJSON(w, r, &p) {
		return
	}
	p.Name = r.PathValue("name")
	c, err := s.Store.LoadCatalog(r.Context())
	if err != nil {
		s.respond(w, nil, err)
		return
	}
	errs := c.CheckPlan(p)
	if !validName(p.Name) {
		errs = append(errs, "the name is lower-case letters, digits, . _ - (up to 63)")
	}
	if len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": "the plan has errors", "errors": errs})
		return
	}
	ctx := audit.WithActor(r.Context(), actor(r))
	err = s.Store.WithTx(ctx, func(tx *store.Store) error {
		if err := tx.SaveRecipe(ctx, p); err != nil {
			return err
		}
		return tx.Audit(ctx, "recipe.save", "recipe "+p.Name, strconv.Itoa(len(p.Steps))+" steps")
	})
	if errors.Is(err, store.ErrManaged) {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	s.respond(w, p, err)
}

// deleteRecipe removes a UI recipe; a file recipe is removed in the file.
func (s server) deleteRecipe(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	ctx := audit.WithActor(r.Context(), actor(r))
	err := s.Store.WithTx(ctx, func(tx *store.Store) error {
		if err := tx.DeleteRecipe(ctx, name); err != nil {
			return err
		}
		return tx.Audit(ctx, "recipe.delete", "recipe "+name, "")
	})
	switch {
	case errors.Is(err, store.ErrNoRecipe):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, store.ErrManaged):
		writeError(w, http.StatusConflict, err.Error())
	case err != nil:
		s.respond(w, nil, err)
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// recipeYAML writes a plan as the recipes: section of the config file, to
// copy into it.
func (s server) recipeYAML(w http.ResponseWriter, r *http.Request) {
	var p model.Plan
	if !readJSON(w, r, &p) {
		return
	}
	if p.Name == "" {
		p.Name = "my-plan"
	}
	b, err := declare.ExportRecipes(p)
	if err != nil {
		s.respond(w, nil, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"yaml": string(b)})
}

// resume runs a failed or cancelled run again from where it stopped.
func (s server) resume(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	switch err := s.Runner.Resume(audit.WithActor(r.Context(), actor(r)), id); {
	case errors.Is(err, store.ErrNoRun):
		writeError(w, http.StatusNotFound, "not found")
	case err != nil:
		writeError(w, http.StatusConflict, err.Error())
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

func validName(name string) bool {
	if name == "" || len(name) > 63 {
		return false
	}
	for i, c := range name {
		ok := c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || i > 0 && (c == '.' || c == '_' || c == '-')
		if !ok {
			return false
		}
	}
	return true
}
