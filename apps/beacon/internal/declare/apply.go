package declare

import (
	"context"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// Result is what Apply did (or, in a dry run, would do).
type Result struct {
	Changes []Change
	DryRun  bool
}

// Apply makes the stored catalog equal to next in one transaction and records
// every change in the audit log, under the actor in ctx. With dryRun it only
// computes the changes.
func Apply(ctx context.Context, st *store.Store, next catalog.Catalog, dryRun bool) (Result, error) {
	res := Result{DryRun: dryRun}
	err := st.WithTx(ctx, func(tx *store.Store) error {
		cur, err := tx.LoadCatalog(ctx)
		if err != nil {
			return err
		}
		res.Changes = Diff(cur, next)
		if dryRun || len(res.Changes) == 0 {
			return nil
		}
		if err := tx.SaveCatalog(ctx, next); err != nil {
			return err
		}
		for _, c := range res.Changes {
			if err := tx.Audit(ctx, "config.apply", c.Kind+" "+c.Name, c.String()); err != nil {
				return err
			}
		}
		return nil
	})
	return res, err
}
