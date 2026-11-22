package store

// schemaV2 (frp-gate 1.1) adds ownership by the config file and the audit log.
//
// managed = 1: the row is declared in FRP_GATE_CONFIG / `frp-gate apply`.
// Apply creates, updates and deletes such rows; the UI and API refuse to
// edit or delete them. Rows made in the UI keep managed = 0 and are never
// touched by apply.
//
// secret_managed = 1: the token (clients) or plugin key (instances) comes
// from the file (token_env / token_file / token_sha256), so the UI does not
// rotate it.
const schemaV2 = `
ALTER TABLE zones         ADD COLUMN managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE instances     ADD COLUMN managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE instances     ADD COLUMN secret_managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients       ADD COLUMN managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients       ADD COLUMN secret_managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE client_groups ADD COLUMN managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE grants        ADD COLUMN managed INTEGER NOT NULL DEFAULT 0;

-- Admin actions. Never holds a secret: tokens and keys are only noted as
-- "token rotated" and the like.
CREATE TABLE audit_log (
	id     INTEGER PRIMARY KEY,
	at     INTEGER NOT NULL,
	source TEXT NOT NULL,              -- ui | api | apply | start
	actor  TEXT NOT NULL DEFAULT '',   -- remote address, or the config file
	action TEXT NOT NULL,              -- e.g. client.create
	object TEXT NOT NULL DEFAULT '',   -- e.g. home-pi
	detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX audit_log_at ON audit_log(at);
`
