package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// SetUnreleased stores the unreleased-changes counts and returns the packages
// whose count, tag or branch changed. Unchanged rows are not written.
func (s *Store) SetUnreleased(ctx context.Context, us []model.Unreleased) ([]string, error) {
	var changed []string
	err := s.WithTx(ctx, func(tx *Store) error {
		for _, u := range us {
			var tag, branch, url string
			var commits int
			err := tx.q.QueryRowContext(ctx, "SELECT tag, branch, commits, url FROM unreleased WHERE package = ?", u.Package).
				Scan(&tag, &branch, &commits, &url)
			if err == nil && tag == u.Tag && branch == u.Branch && commits == u.Commits && url == u.URL {
				continue
			}
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			if _, err := tx.q.ExecContext(ctx, `INSERT INTO unreleased (package, tag, branch, commits, url, checked)
				VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (package) DO UPDATE SET
				tag = excluded.tag, branch = excluded.branch, commits = excluded.commits, url = excluded.url, checked = excluded.checked`,
				u.Package, u.Tag, u.Branch, u.Commits, u.URL, tx.unix()); err != nil {
				return err
			}
			changed = append(changed, u.Package)
		}
		return nil
	})
	return changed, err
}

// Unreleased returns the stored counts by package.
func (s *Store) Unreleased(ctx context.Context) (map[string]model.Unreleased, error) {
	rows, err := s.q.QueryContext(ctx, "SELECT package, tag, branch, commits, url, checked FROM unreleased")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]model.Unreleased{}
	for rows.Next() {
		var u model.Unreleased
		var checked int64
		if err := rows.Scan(&u.Package, &u.Tag, &u.Branch, &u.Commits, &u.URL, &checked); err != nil {
			return nil, err
		}
		u.Checked = time.Unix(checked, 0)
		out[u.Package] = u
	}
	return out, rows.Err()
}
