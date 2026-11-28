package store

// migrations are applied in order (go-kit sqlitex, PRAGMA user_version).
// Never edit a released migration: append a new one.
var migrations = []string{schemaV1, schemaV2, schemaV3}

// schemaV3: recipes, and what a run was started from (Phase 3).
const schemaV3 = `
CREATE TABLE recipes (
	name    TEXT PRIMARY KEY,
	spec    TEXT NOT NULL,
	managed INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE plan_runs ADD COLUMN recipe TEXT NOT NULL DEFAULT '';
ALTER TABLE plan_runs ADD COLUMN fail_fast INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plan_runs ADD COLUMN plan TEXT NOT NULL DEFAULT '';
`

// schemaV2: unreleased changes, plan runs, locks (Phase 2).
const schemaV2 = `
CREATE TABLE unreleased (
	package TEXT PRIMARY KEY,
	tag     TEXT NOT NULL,
	branch  TEXT NOT NULL,
	commits INTEGER NOT NULL,
	url     TEXT NOT NULL DEFAULT '',
	checked INTEGER NOT NULL
) WITHOUT ROWID;

-- A plan run is a copy of the plan at start time. A step's data is the
-- model.Step as JSON; state and package are columns for the queries.
CREATE TABLE plan_runs (
	id       INTEGER PRIMARY KEY,
	title    TEXT NOT NULL,
	state    TEXT NOT NULL,
	source   TEXT NOT NULL,
	actor    TEXT NOT NULL,
	created  INTEGER NOT NULL,
	finished INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX plan_runs_by_state ON plan_runs (state, id);
CREATE TABLE plan_steps (
	run     INTEGER NOT NULL REFERENCES plan_runs(id) ON DELETE CASCADE,
	key     TEXT NOT NULL,
	pos     INTEGER NOT NULL,
	package TEXT NOT NULL,
	state   TEXT NOT NULL,
	data    TEXT NOT NULL,
	PRIMARY KEY (run, key)
) WITHOUT ROWID;
CREATE INDEX plan_steps_by_package ON plan_steps (package, state);

-- Leases on packages and repos: a restart knows what was held. A lock is
-- held by one step and released when it finishes.
CREATE TABLE locks (
	name  TEXT PRIMARY KEY,
	run   INTEGER NOT NULL,
	step  TEXT NOT NULL,
	since INTEGER NOT NULL
) WITHOUT ROWID;
`

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
