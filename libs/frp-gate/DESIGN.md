# frp-gate design

Why frp-gate works the way it does, and what was checked in frp and Caddy before building on it.
Checked against frp **v0.65.0** (the version docker-frp ships) and **v0.72.0** (latest, Nov 2026),
and Caddy **v2.10.2**, by reading their source and running them (`test/integration`, `caddy adapt`).

## Goals and limits

- One frps is shared by many clients. Each client may only claim the names and ports it was
  granted. Isolation comes from grants, not from one frps per tenant.
- frp-gate never manages frps or Caddy (no restarts, no config rewrites, no Docker socket). Their
  config is written once; frp-gate is reached through frp's plugin protocol and Caddy's `ask`.
- Small: one static binary, SQLite, a 1 GB VPS shared with Caddy and frps.
- Not in v1: SSO, self-service, metrics, stcp/xtcp/sudp.

## Components

```
cmd/frp-gate         wiring, two listeners, prune loop, healthcheck
internal/policy      every decision (Login, NewProxy, Ping, NewWorkConn, CloseProxy, Ask)
internal/pattern     host patterns: literal labels, {client}, leading *
internal/frpplugin   frps HTTP plugin protocol, decoded with frp's pkg/plugin/server types
internal/ask         Caddy on-demand TLS permission endpoint
internal/admin       html/template UI (plain forms, no JS build) + JSON API, shared Service
internal/store       SQLite (modernc.org/sqlite, no cgo), schema migrations by user_version
```

Two listeners keep the trust boundaries apart:

- **:7600, internal.** `/frps/{key}` (plugin), `/tls/ask` and `/healthz`. Only frps and Caddy
  need it. It is never published.
- **:7601, admin.** UI and API, password-protected, meant to sit behind Caddy.

## Authentication: the plugin is the authority

frps calls the Login plugin **before** its own `auth` check (`server/service.go`,
`handleConnection`: `pluginManager.Login`, then `RegisterControl`, then `authVerifier.VerifyLogin`).
frps' own check uses one shared `auth.token`, which is useless for per-client identity. So:

- frps runs **without `auth.token`**. Its token check then passes for everyone, and frp-gate
  decides. (docker-frp leaves `auth.token` unset when `AUTH_TOKEN` is empty.)
- A client sends `user = "<client>"` and `metadatas.token = "<token>"`. frps keeps the Login
  message and repeats `user` and `metas` in the `UserInfo` of every later op (NewProxy, CloseProxy,
  Ping, NewWorkConn). frp-gate therefore re-checks the token on **every** op, statelessly: a
  disabled client or a rotated token fails at the next op, even after a frp-gate restart.
- Tokens are 256-bit random values (`fg_` + base32), shown once and stored as SHA-256. They are not
  passwords, so a slow hash would add nothing.
- The plugin URL is `/frps/<instance key>`. frps can only set the plugin `addr` and `path`; it sends
  no custom headers (`pkg/plugin/server/http.go` only adds `X-Frp-Reqid`). The path therefore both
  identifies the frps instance and authenticates it. An unknown key gets 404, which frps treats as
  a rejection.
- frpc's `user` also prefixes proxy names (`sahin.web`), so proxy names cannot collide between
  clients.

## Revocation

There is no frps API to kick a client: the dashboard API (v0.65 `server/dashboard_api.go`, v0.72
`server/api_router.go`) only lists clients and proxies and deletes **offline** proxies. Revocation
therefore has to work through plugin answers. What frps does with each:

| Op | Where | Effect of a rejection |
| --- | --- | --- |
| Ping | `server/control.go` `handlePing` | frps sends `Pong{Error}` and does not refresh `lastPing`. frpc closes the session on a Pong error (`client/control.go` `handlePong` → `closeSession`). frps closes it itself once `transport.heartbeatTimeout` passes without an accepted Ping (`heartbeatWorker`). |
| NewWorkConn | `server/service.go` `RegisterWorkConn` | That work connection is refused. Connections already in frps' pool or in use are not affected. |
| Login | `server/service.go` | The reconnect fails. frpc keeps retrying with backoff (with `loginFailExit = false`). |
| NewUserConn | | Not sent for http proxies, so it is not useful here. |

**The catch: heartbeats are off by default.** With `transport.tcpMux = true` (the default),
`transport.heartbeatTimeout` defaults to **-1 on frps** and `transport.heartbeatInterval` to
**-1 on frpc** (`pkg/config/v1/server.go` / `client.go`, `Complete`). frpc then sends no Ping and
frps checks no timeout, so refusing Pings alone would never cut anyone off. Same in v0.65 and
v0.72. Both sides can be set explicitly regardless of tcpMux; the heartbeat workers only test
`> 0`.

Decision:

- frps.toml sets `transport.heartbeatTimeout = 60`. This makes frps enforce Pings on its own,
  whatever the client does.
- Every frpc.toml sets `transport.heartbeatInterval = 15`. A client without it sends no Pings and
  is dropped by frps after 60 s. Leaving it out cannot be used to dodge revocation; it only makes
  the client unusable.
- frp-gate refuses Ping and NewWorkConn for a disabled client or a stale token. Ping is also
  refused when one of the session's recorded proxies is no longer covered by a grant, so
  **removing a grant** ends sessions that use it too.
- The TLS ask refuses a disabled client's names at once.
- If frp-gate itself is down, Pings fail and sessions drop after 60 s. That is fail-closed. A
  restart takes about a second, well inside the timeout.

Measured by `test/integration/run.sh` (heartbeatInterval 5 s, frps heartbeatTimeout 20 s), with
the same result on v0.65.0 and v0.72.0:

- **New requests** to the disabled client's name failed after 3–6 s (runs vary with where the Ping cycle is). The first requests after
  disabling still went through a work connection frps already had. The cut came with the next Ping
  (frp-gate log: 1 NewWorkConn refused, 1 Ping refused, then Logins refused).
- **The session and all its proxies** were gone within 13–16 s, measured as "not seen" in
  frp-gate's status with a 15 s session timeout. The client's tcp port was closed.
- **An HTTP request in flight** at that moment (`?wait=30s`) did not complete. frpc closing the
  session tears down the multiplexed connection with every stream on it.
- **A client sending no heartbeats** (carol in the test) was dropped by frps on its own
  (`heartbeat timeout` in the frps log), so revocation does not depend on the client behaving.

With the production values (15 s / 60 s), a well-behaved client is cut off within about 15 s and a
non-cooperating one within 60 s.

## Proxy validation

### subdomain or customDomains

Only `customDomains` is accepted; a proxy with `subdomain` is refused with a message saying to use
the full name. Reasons, from `pkg/config/v1/validation/proxy.go`:

- `subdomain` cannot contain `.` or `*`. It is one label, so `app.pc.sahin.<zone>` cannot be
  written with it.
- `subDomainHost` is one global frps value, so it cannot serve several zones.
- When `subDomainHost` is set, frps **rejects** `customDomains` under it. Enabling it would break
  the multi-label names that grants are designed for.

So frps runs without `subDomainHost`.

### Names

Each entry in `customDomains` is lower-cased and validated, then must be covered by a host grant of
the client in a zone the frps instance serves. A pattern `*.S` covers a name with one or more
labels before `S`, and an frp wildcard request `*.R` is covered if every name it stands for is
covered (`R` ends with `S`). This matches frps' own routing: `pkg/util/vhost` tries the name, then
replaces leading labels with `*` one by one, so `*.x.y` serves names of any depth below `x.y`.
`{client}` matches exactly one label and must equal the client's name. Types `http`, `https` and
`tcpmux` are checked this way.

### Ports

`tcp` and `udp` need an explicit `remotePort` inside a port grant for that frps and protocol.
`remotePort = 0` (frps picks one) is refused, because frp-gate cannot know which port it would
get. Keep frps `allowPorts` in line with the grants as a second fence.

### Other types

`stcp`, `xtcp` and `sudp` expose nothing publicly, but v1 refuses them to keep the model small.
Unknown ops (for example NewUserConn, if configured) are allowed unchanged.

## TLS ask

Caddy asks `GET /tls/ask?domain=<name>` before getting a certificate for a name no site claims.
The spec asked for "200 if granted to an active client". That alone is risky: with `*.{client}`
grants, anyone can make Caddy request certificates for random names (`x1.sahin…`, `x2.sahin…`),
and Let's Encrypt allows only 50 certificates per registered domain per week. One script could
block issuance for the whole domain.

So the default `claimed` mode also requires that an enabled grantee **used** the name in an
accepted proxy within `FRP_GATE_CLAIM_RETENTION` (30 days). NewProxy records names, and every
accepted Ping refreshes the names of the session's live proxies, so renewals of names in use keep
working. A claim of a wildcard (`*.pc.sahin.<zone>`) covers names below it. `granted` mode is
available.

## Caddy

Checked with `caddy adapt` on Caddy v2.10.2 (built with `caddy-dns/cloudflare` for the `acme_dns`
case):

- **Site precedence.** A catch-all `https://` site is sorted after sites with host names. In the
  adapted JSON the named site's route comes first and the catch-all route is last. Each named site
  gets its own automation policy (`subjects: [...]`); the catch-all's `on_demand` policy has no
  subjects and only applies to names nobody else claims. So the catch-all never takes another
  site's name or certificate.
- **Global `acme_dns`.** `caddyconfig/httpcaddyfile/tlsapp.go` `fillInGlobalACMEDefaults` copies
  the global DNS provider into every ACME issuer that has none. Adapted output with a global
  `acme_dns cloudflare` and `https:// { tls { on_demand } }`: the on-demand policy's issuer has
  `challenges.dns.provider.name = "cloudflare"`. A DNS challenge for a zone the token does not
  cover fails. Adding `issuer acme` to the catch-all does not help: Caddy 2.10.2 refuses the
  config ("automation policy from site block is also default/catch-all policy … in conflict").
- **Fix.** Remove the global `acme_dns` and put `tls { dns cloudflare … }` in a snippet imported
  by the sites that need DNS. The catch-all's issuers then have no DNS challenge, so HTTP-01 /
  TLS-ALPN is used. Verified in the adapted JSON. The README shows the snippet.
- `on_demand_tls { ask … }` is still accepted and adapts to `on_demand.permission` with module
  `http`.

## Data model

SQLite tables: `instances` (frps, key hash), `zones`, `instance_zones`, `clients` (token hash,
disabled, last login), `client_groups`, `group_members`, `grants` (one of client/group; host:
zone + full pattern, port: instance + proto + range), `sessions` (instance, run_id, last seen),
`proxies` (per session), `claims` (name, client, last claimed), `settings` (session signing key).

- A host grant stores the full pattern, validated to lie inside its zone. Deleting a zone with
  grants is refused. Deleting a client, group or instance deletes its grants.
- `sessions`/`proxies` survive a frp-gate restart. frps does not resend NewProxy, so memory alone
  would forget who is connected. Sessions not seen for 24 h are pruned (frps may restart without
  sending CloseProxy). "Connected" means seen within `FRP_GATE_SESSION_TIMEOUT` (90 s).
- A session's `run_id` may be empty at Login (frps assigns it after the plugin call). Sessions are
  recorded from the first NewProxy or Ping, and Login records the client's last address, host name
  and frpc version.
- One SQLite connection (`SetMaxOpenConns(1)`) in WAL mode. Writes are tiny (one per Ping), and
  this avoids `SQLITE_BUSY`.

## Admin UI and API

- Plain HTML forms with POST/redirect/GET, `html/template`, one embedded stylesheet. No htmx was
  needed. The only script is inline `confirm()` on destructive buttons.
- One admin password (`FRP_GATE_ADMIN_PASSWORD[_FILE]`). Sessions are HMAC-signed cookies
  (`HttpOnly`, `SameSite=Strict`, `Secure` behind HTTPS), signed with a random key kept in SQLite.
  CSRF is covered by Go 1.25's `http.CrossOriginProtection`. A failed login waits 1 s.
- Secrets (client tokens, instance keys) are shown once, in the response that created them, and
  never logged.
- The JSON API uses Basic auth and addresses objects by name, so it is easy to script. The UI and
  the API share one `Service`, so validation is identical.

## Packaging and release

- `Dockerfile`: `src` → `test` (`go vet`, `go test`) → `build` (cross-compiled, `CGO_ENABLED=0`) →
  `runtime` (distroless static, nonroot, ~25 MB). The arm64 image needs no QEMU.
- `frp-gate.publish.yml` runs on `release: published`, filtered to tags `frp-gate-vX.Y.Z`. It
  runs hadolint, unit tests and the integration test against frp 0.65.0 and 0.72.0, then pushes
  amd64 + arm64.
- **Does `push: tags` (used by docker-frp's workflow) fire for `gh release create`?** Yes, when the
  release creates the tag. Release `docker-frp-v1.2.0` was published at 12:30:29Z and its
  `docker-frp.publish.yml` run started at 12:30:31Z with `event: push` (public Actions API). It
  does not fire if the tag already existed before the release, or if the release is created by a
  workflow using `GITHUB_TOKEN`. `release: published` also covers releases made from an existing
  tag.

## Known limits and follow-ups

- docker-frp's masked config print hides `token =` lines but not `metadatas.token =`. A client
  that writes its token literally into frpc.toml with docker-frp shows it in `docker logs`. The
  README uses `{{ .Envs.FRP_GATE_TOKEN }}` instead. docker-frp's masking could learn `metadatas.*`.
- frps does not pass `X-Forwarded-Proto` on; clients set it with `requestHeaders.set`.
- Admin auth is a single password; no audit log beyond frp-gate's own log lines.
