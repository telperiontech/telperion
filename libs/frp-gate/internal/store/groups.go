package store

import (
	"context"
	"time"
)

// Group bundles clients so grants can be given to all of them at once
// (e.g. every member of project "videochat" gets *.{client}.<zone>).
type Group struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	MemberIDs []int64   `json:"member_ids"`
}

// CreateGroup adds a group. name must be a validated label.
func (s *Store) CreateGroup(ctx context.Context, name string) (Group, error) {
	now := s.unix()
	res, err := s.db.ExecContext(ctx, "INSERT INTO client_groups (name, created_at) VALUES (?, ?)", name, now)
	if err != nil {
		return Group{}, mapErr(err)
	}
	id, _ := res.LastInsertId()
	return Group{ID: id, Name: name, CreatedAt: time.Unix(now, 0), MemberIDs: []int64{}}, nil
}

// ListGroups returns all groups with their member ids.
func (s *Store) ListGroups(ctx context.Context) ([]Group, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT id, name, created_at FROM client_groups ORDER BY name")
	if err != nil {
		return nil, err
	}
	var out []Group
	idx := map[int64]int{}
	for rows.Next() {
		var g Group
		var created int64
		if err := rows.Scan(&g.ID, &g.Name, &created); err != nil {
			rows.Close()
			return nil, err
		}
		g.CreatedAt = time.Unix(created, 0)
		g.MemberIDs = []int64{}
		idx[g.ID] = len(out)
		out = append(out, g)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows, err = s.db.QueryContext(ctx, "SELECT group_id, client_id FROM group_members ORDER BY client_id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var gid, cid int64
		if err := rows.Scan(&gid, &cid); err != nil {
			return nil, err
		}
		if i, ok := idx[gid]; ok {
			out[i].MemberIDs = append(out[i].MemberIDs, cid)
		}
	}
	return out, rows.Err()
}

// GroupIDsOfClient returns the groups a client is a member of.
func (s *Store) GroupIDsOfClient(ctx context.Context, clientID int64) ([]int64, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT group_id FROM group_members WHERE client_id = ? ORDER BY group_id", clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// IsMember reports whether a client belongs to a group.
func (s *Store) IsMember(ctx context.Context, groupID, clientID int64) (bool, error) {
	var n int
	err := s.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM group_members WHERE group_id = ? AND client_id = ?", groupID, clientID).Scan(&n)
	return n > 0, err
}

// EnabledMembers returns the enabled clients of a group.
func (s *Store) EnabledMembers(ctx context.Context, groupID int64) ([]Client, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT "+prefixCols("c.", clientCols)+" FROM clients c JOIN group_members m ON m.client_id = c.id"+
			" WHERE m.group_id = ? AND c.disabled = 0 ORDER BY c.name", groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Client
	for rows.Next() {
		c, err := scanClient(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// AddMember puts a client into a group (no-op if already a member).
func (s *Store) AddMember(ctx context.Context, groupID, clientID int64) error {
	_, err := s.db.ExecContext(ctx,
		"INSERT OR IGNORE INTO group_members (group_id, client_id) VALUES (?, ?)", groupID, clientID)
	return mapErr(err)
}

// RemoveMember takes a client out of a group.
func (s *Store) RemoveMember(ctx context.Context, groupID, clientID int64) error {
	return affected(s.db.ExecContext(ctx,
		"DELETE FROM group_members WHERE group_id = ? AND client_id = ?", groupID, clientID))
}

// DeleteGroup removes a group, its grants and memberships.
func (s *Store) DeleteGroup(ctx context.Context, id int64) error {
	return affected(s.db.ExecContext(ctx, "DELETE FROM client_groups WHERE id = ?", id))
}

// GroupByName returns the group with this name.
func (s *Store) GroupByName(ctx context.Context, name string) (Group, error) {
	var g Group
	var created int64
	err := s.db.QueryRowContext(ctx, "SELECT id, name, created_at FROM client_groups WHERE name = ?", name).
		Scan(&g.ID, &g.Name, &created)
	if err != nil {
		return Group{}, mapErr(err)
	}
	g.CreatedAt = time.Unix(created, 0)
	return g, nil
}
