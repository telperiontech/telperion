package store

// schemaV1 is the first schema. Times are unix seconds.
const schemaV1 = `
CREATE TABLE settings (
	key   TEXT PRIMARY KEY,
	value BLOB NOT NULL
);

-- An frps that uses frp-gate as its plugin. key_hash identifies it from the
-- plugin URL path; server_addr is only shown in frpc.toml snippets.
CREATE TABLE instances (
	id          INTEGER PRIMARY KEY,
	name        TEXT NOT NULL UNIQUE,
	key_hash    TEXT NOT NULL UNIQUE,
	server_addr TEXT NOT NULL DEFAULT '',
	created_at  INTEGER NOT NULL
);

CREATE TABLE zones (
	id         INTEGER PRIMARY KEY,
	domain     TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL
);

-- Which zones an frps may serve.
CREATE TABLE instance_zones (
	instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
	zone_id     INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
	PRIMARY KEY (instance_id, zone_id)
);

CREATE TABLE clients (
	id                 INTEGER PRIMARY KEY,
	name               TEXT NOT NULL UNIQUE,
	token_hash         TEXT NOT NULL UNIQUE,
	disabled           INTEGER NOT NULL DEFAULT 0,
	note               TEXT NOT NULL DEFAULT '',
	created_at         INTEGER NOT NULL,
	last_login_at      INTEGER NOT NULL DEFAULT 0,
	last_login_addr    TEXT NOT NULL DEFAULT '',
	last_login_version TEXT NOT NULL DEFAULT '',
	last_login_host    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE client_groups (
	id         INTEGER PRIMARY KEY,
	name       TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL
);

CREATE TABLE group_members (
	group_id  INTEGER NOT NULL REFERENCES client_groups(id) ON DELETE CASCADE,
	client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	PRIMARY KEY (group_id, client_id)
);
CREATE INDEX group_members_client ON group_members(client_id);

-- A grant belongs to exactly one client or one group.
-- host: pattern (full host pattern, inside zone_id).
-- port: proto + port range on instance_id.
CREATE TABLE grants (
	id          INTEGER PRIMARY KEY,
	client_id   INTEGER REFERENCES clients(id) ON DELETE CASCADE,
	group_id    INTEGER REFERENCES client_groups(id) ON DELETE CASCADE,
	kind        TEXT NOT NULL,
	zone_id     INTEGER REFERENCES zones(id) ON DELETE RESTRICT,
	pattern     TEXT NOT NULL DEFAULT '',
	instance_id INTEGER REFERENCES instances(id) ON DELETE CASCADE,
	proto       TEXT NOT NULL DEFAULT '',
	port_from   INTEGER NOT NULL DEFAULT 0,
	port_to     INTEGER NOT NULL DEFAULT 0,
	created_at  INTEGER NOT NULL,
	CHECK ((client_id IS NULL) <> (group_id IS NULL)),
	CHECK (
		(kind = 'host' AND zone_id IS NOT NULL AND pattern <> '') OR
		(kind = 'port' AND instance_id IS NOT NULL AND proto IN ('tcp', 'udp')
			AND port_from BETWEEN 1 AND 65535 AND port_to BETWEEN port_from AND 65535)
	)
);
CREATE INDEX grants_client ON grants(client_id);
CREATE INDEX grants_group ON grants(group_id);

-- A logged-in frpc, as seen through Ping / NewProxy / NewWorkConn.
CREATE TABLE sessions (
	instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
	run_id      TEXT NOT NULL,
	client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	first_seen  INTEGER NOT NULL,
	last_seen   INTEGER NOT NULL,
	PRIMARY KEY (instance_id, run_id)
);

-- Proxies frps accepted. Names are unique per frps (frpc prefixes them with the user).
CREATE TABLE proxies (
	instance_id INTEGER NOT NULL,
	run_id      TEXT NOT NULL,
	name        TEXT NOT NULL,
	type        TEXT NOT NULL,
	domains     TEXT NOT NULL DEFAULT '',
	remote_port INTEGER NOT NULL DEFAULT 0,
	created_at  INTEGER NOT NULL,
	PRIMARY KEY (instance_id, name),
	FOREIGN KEY (instance_id, run_id) REFERENCES sessions(instance_id, run_id) ON DELETE CASCADE
);
CREATE INDEX proxies_session ON proxies(instance_id, run_id);

-- Host names (or frp wildcard names) a client actually used, for the TLS ask.
CREATE TABLE claims (
	name         TEXT NOT NULL,
	client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
	last_claimed INTEGER NOT NULL,
	PRIMARY KEY (name, client_id)
);
`
