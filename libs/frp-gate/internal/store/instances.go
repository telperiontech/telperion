package store

import (
	"context"
	"time"
)

// Instance is an frps that calls frp-gate as its server plugin.
type Instance struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	ServerAddr    string    `json:"server_addr"`
	CreatedAt     time.Time `json:"created_at"`
	ZoneIDs       []int64   `json:"zone_ids"`
	Managed       bool      `json:"managed"`
	SecretManaged bool      `json:"key_managed"`
	KeyHash       string    `json:"-"` // token.Hash of the plugin key
}

// CreateInstance adds an frps. keyHash is token.Hash of its plugin key.
func (s *Store) CreateInstance(ctx context.Context, name, keyHash, serverAddr string) (Instance, error) {
	now := s.unix()
	res, err := s.q.ExecContext(ctx,
		"INSERT INTO instances (name, key_hash, server_addr, created_at) VALUES (?, ?, ?, ?)",
		name, keyHash, serverAddr, now)
	if err != nil {
		return Instance{}, mapErr(err)
	}
	id, _ := res.LastInsertId()
	return Instance{ID: id, Name: name, ServerAddr: serverAddr, CreatedAt: time.Unix(now, 0)}, nil
}

// InstanceByKeyHash finds the frps a plugin request comes from.
func (s *Store) InstanceByKeyHash(ctx context.Context, keyHash string) (Instance, error) {
	return s.instanceWhere(ctx, "key_hash = ?", keyHash)
}

// InstanceByName finds an frps by name.
func (s *Store) InstanceByName(ctx context.Context, name string) (Instance, error) {
	return s.instanceWhere(ctx, "name = ?", name)
}

// InstanceByID finds an frps by id.
func (s *Store) InstanceByID(ctx context.Context, id int64) (Instance, error) {
	return s.instanceWhere(ctx, "id = ?", id)
}

func (s *Store) instanceWhere(ctx context.Context, where string, arg any) (Instance, error) {
	var in Instance
	var created int64
	err := s.q.QueryRowContext(ctx,
		"SELECT id, name, server_addr, created_at, managed, secret_managed, key_hash FROM instances WHERE "+where, arg).
		Scan(&in.ID, &in.Name, &in.ServerAddr, &created, &in.Managed, &in.SecretManaged, &in.KeyHash)
	if err != nil {
		return Instance{}, mapErr(err)
	}
	in.CreatedAt = time.Unix(created, 0)
	in.ZoneIDs, err = s.instanceZoneIDs(ctx, in.ID)
	return in, err
}

// ListInstances returns all frps instances with their zones.
func (s *Store) ListInstances(ctx context.Context) ([]Instance, error) {
	rows, err := s.q.QueryContext(ctx, "SELECT id, name, server_addr, created_at, managed, secret_managed, key_hash FROM instances ORDER BY name")
	if err != nil {
		return nil, err
	}
	var out []Instance
	for rows.Next() {
		var in Instance
		var created int64
		if err := rows.Scan(&in.ID, &in.Name, &in.ServerAddr, &created, &in.Managed, &in.SecretManaged, &in.KeyHash); err != nil {
			rows.Close()
			return nil, err
		}
		in.CreatedAt = time.Unix(created, 0)
		out = append(out, in)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if out[i].ZoneIDs, err = s.instanceZoneIDs(ctx, out[i].ID); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (s *Store) instanceZoneIDs(ctx context.Context, id int64) ([]int64, error) {
	rows, err := s.q.QueryContext(ctx, "SELECT zone_id FROM instance_zones WHERE instance_id = ? ORDER BY zone_id", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var z int64
		if err := rows.Scan(&z); err != nil {
			return nil, err
		}
		ids = append(ids, z)
	}
	return ids, rows.Err()
}

// SetInstanceZones replaces the zones an frps may serve.
func (s *Store) SetInstanceZones(ctx context.Context, id int64, zoneIDs []int64) error {
	return s.WithTx(ctx, func(tx *Store) error {
		if err := affected(tx.q.ExecContext(ctx, "UPDATE instances SET id = id WHERE id = ?", id)); err != nil {
			return err
		}
		if _, err := tx.q.ExecContext(ctx, "DELETE FROM instance_zones WHERE instance_id = ?", id); err != nil {
			return err
		}
		for _, z := range zoneIDs {
			if _, err := tx.q.ExecContext(ctx, "INSERT OR IGNORE INTO instance_zones (instance_id, zone_id) VALUES (?, ?)", id, z); err != nil {
				return mapErr(err)
			}
		}
		return nil
	})
}

// SetInstanceServerAddr replaces the address shown in frpc.toml snippets.
func (s *Store) SetInstanceServerAddr(ctx context.Context, id int64, addr string) error {
	return affected(s.q.ExecContext(ctx, "UPDATE instances SET server_addr = ? WHERE id = ?", addr, id))
}

// SetInstanceKey replaces an frps plugin key (rotation).
func (s *Store) SetInstanceKey(ctx context.Context, id int64, keyHash string) error {
	return affected(s.q.ExecContext(ctx, "UPDATE instances SET key_hash = ? WHERE id = ?", keyHash, id))
}

// DeleteInstance removes an frps, its port grants and its sessions.
func (s *Store) DeleteInstance(ctx context.Context, id int64) error {
	return affected(s.q.ExecContext(ctx, "DELETE FROM instances WHERE id = ?", id))
}
