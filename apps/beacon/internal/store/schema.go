package store

// migrations are applied in order (go-kit sqlitex, PRAGMA user_version).
// Never edit a released migration: append a new one.
var migrations = []string{schemaV1}

const schemaV1 = `
CREATE TABLE settings (
	key   TEXT PRIMARY KEY,
	value BLOB NOT NULL
);

-- Configuration. Rows from the YAML file are managed; UI-made rows (a later
-- phase) are not, and apply never touches those. spec is the catalog object as
-- JSON, with secret references only.
CREATE TABLE projects (
	name    TEXT PRIMARY KEY,
	spec    TEXT NOT NULL,
	managed INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE packages (
	name    TEXT PRIMARY KEY,
	project TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
	spec    TEXT NOT NULL,
	managed INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE targets (
	name    TEXT PRIMARY KEY,
	spec    TEXT NOT NULL,
	managed INTEGER NOT NULL DEFAULT 1
);

-- Observations: the latest state per key; transitions go to events.
CREATE TABLE versions (
	package    TEXT NOT NULL,
	version    TEXT NOT NULL,
	first_seen INTEGER NOT NULL,
	PRIMARY KEY (package, version)
) WITHOUT ROWID;
CREATE TABLE stage_states (
	package TEXT NOT NULL,
	version TEXT NOT NULL,
	stage   TEXT NOT NULL,
	target  TEXT NOT NULL DEFAULT '',
	state   TEXT NOT NULL,
	since   INTEGER NOT NULL,
	url     TEXT NOT NULL DEFAULT '',
	detail  TEXT NOT NULL DEFAULT '',
	PRIMARY KEY (package, version, stage, target)
) WITHOUT ROWID;
CREATE INDEX stage_states_by_target ON stage_states (package, stage, target, state);

-- Append-only log of transitions, pruned by count and age.
CREATE TABLE events (
	id      INTEGER PRIMARY KEY,
	at      INTEGER NOT NULL,
	package TEXT NOT NULL,
	version TEXT NOT NULL,
	stage   TEXT NOT NULL,
	target  TEXT NOT NULL DEFAULT '',
	state   TEXT NOT NULL,
	url     TEXT NOT NULL DEFAULT '',
	detail  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX events_by_package ON events (package, id);

CREATE TABLE audit_log (
	id     INTEGER PRIMARY KEY,
	at     INTEGER NOT NULL,
	source TEXT NOT NULL,
	actor  TEXT NOT NULL,
	action TEXT NOT NULL,
	object TEXT NOT NULL,
	detail TEXT NOT NULL DEFAULT ''
);
`
