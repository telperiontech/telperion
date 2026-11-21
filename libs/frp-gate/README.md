# frp-gate

[![GitHub Container Registry](https://img.shields.io/badge/ghcr.io-frp--gate-blue)](https://github.com/telperiontech/telperion/pkgs/container/frp-gate)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

A multi-tenant gateway for [frp](https://github.com/fatedier/frp). Many people and machines share one
frps. Each client has its own token and may only claim the host names and ports it was granted.

frp-gate is the control plane that makes those decisions. It is one small Go binary (SQLite, ~25 MB
image, about 6 MB of RAM when idle) that:

1. is an **frps server plugin** (`[[httpPlugins]]`: Login, NewProxy, CloseProxy, Ping, NewWorkConn).
   It checks every client's token and every name or port it asks for;
2. answers **Caddy's on-demand TLS `ask`**, so Caddy gets a certificate per name with no DNS API
   token and no per-client config;
3. serves a small **admin UI and JSON API**, where you manage clients, zones, groups and grants and
   see who is connected right now.

frp-gate never starts, stops or rewrites frps or Caddy. Their config is written once. It does not
need the Docker socket.

```
                    ┌──────────── gateway ─────────────────────────────┐
 browser ──HTTPS──▶ │ Caddy ──(on-demand cert? ask)──▶ frp-gate :7600  │
                    │   │                                 ▲            │
                    │   └─HTTP──▶ frps :8080 ──plugin────┘            │
                    │              ▲ :7000                             │
                    └──────────────┼───────────────────────────────────┘
       frpc (user=sahin, token) ───┘      admin ──HTTPS──▶ Caddy ──▶ frp-gate :7601
```

## Contents

- [Quick start](#quick-start)
- [Using your own Caddy](#using-your-own-caddy)
- [Client setup](#client-setup)
- [Concepts](#concepts)
- [Revocation](#revocation)
- [Configuration](#configuration)
- [JSON API](#json-api)
- [Several frps instances](#several-frps-instances)
- [Development](#development)

Design decisions and what was verified against frp and Caddy: [DESIGN.md](DESIGN.md).

## Quick start

A complete stack (Caddy + frps from [docker-frp](../docker-frp) + frp-gate) is in [`examples/`](examples):

| File | What |
| --- | --- |
| [`compose.yml`](examples/compose.yml) | the three services |
| [`Caddyfile`](examples/Caddyfile) | admin site + on-demand catch-all |
| [`frps/frps.toml`](examples/frps/frps.toml) | frps wired to frp-gate |
| [`.env.example`](examples/.env.example) | the two secrets |
| [`frpc.toml`](examples/frpc.toml) | a client's config |

1. **DNS.** Point a wildcard for each zone and a name for the admin UI at the server:
   `*.dev.example.com` and `gate.example.com`.
2. **Files.** Copy `examples/` to the server. Edit `gate.example.com` and the e-mail in the
   `Caddyfile`.
3. **Secrets.** `cp .env.example .env`, set an admin password and a key (`openssl rand -hex 32`).
   The key is shared by frps and frp-gate: frps sends it in the plugin URL path.
4. **Start.** `docker compose up -d`. Open the firewall for 80, 443 and 7000.
5. **Set up** in the admin UI at `https://gate.example.com`:
   - **Zones:** add `dev.example.com`.
   - **Servers:** the `default` server was created from `FRP_GATE_INSTANCE_KEY`. Tick the zone.
   - **Groups:** add `videochat`.
   - **Grants:** give group `videochat` the host pattern `*.{client}` in `dev.example.com`.
   - **Clients:** add `sahin` in group `videochat`. The page shows the token **once** and a
     ready `frpc.toml`.
6. On the client machine run frpc with that config. `https://app.pc.sahin.dev.example.com` works;
   `app.ertan.dev.example.com` is refused for `sahin`.

The frp-gate image runs as uid 65532 (distroless `nonroot`). A named volume works as is. For a bind
mount, `chown 65532:65532` the directory first.

## Using your own Caddy

If Caddy already runs on the gateway, add frp-gate and frps (or only frp-gate if frps runs already,
with the `[[httpPlugins]]` block and `transport.heartbeatTimeout` from
[`frps.toml`](examples/frps/frps.toml)). Then add to the Caddyfile:

```caddyfile
{
	on_demand_tls {
		ask http://127.0.0.1:7600/tls/ask
	}
}

https:// {
	tls {
		on_demand
	}
	reverse_proxy 127.0.0.1:8080 # frps vhostHTTPPort
}
```

Sites with a host name (`cloud.example.org { ... }`) always take priority over the `https://`
catch-all. Their certificates are managed as before; the on-demand policy only applies to names no
other site claims.

### If the global options set `acme_dns`

A global `acme_dns` applies to **every** ACME issuer that has no DNS provider of its own, the
on-demand catch-all included. Caddy then tries a DNS challenge for the client names, and that fails
when the DNS token does not cover those zones. A site-level `tls { issuer acme }` does not help;
Caddy 2.10 refuses that Caddyfile. Move the DNS provider from the global options into the sites
that need it:

```caddyfile
{
	# acme_dns cloudflare {env.CLOUDFLARE_API_TOKEN}   ← remove
	on_demand_tls {
		ask http://127.0.0.1:7600/tls/ask
	}
}

(dns_cert) {
	tls {
		dns cloudflare {env.CLOUDFLARE_API_TOKEN}
	}
}

cloud.example.org {
	import dns_cert
	reverse_proxy ...
}

https:// {
	tls {
		on_demand # HTTP-01 / TLS-ALPN, no DNS token needed
	}
	reverse_proxy 127.0.0.1:8080
}
```

Both forms were checked with `caddy adapt` (Caddy 2.10.2); see [DESIGN.md](DESIGN.md#caddy).

## Client setup

A client identifies itself with the frpc `user` (the client name) and its token in
`metadatas.token`. The admin UI prints this for each client:

```toml
serverAddr = "gateway.example.com"
serverPort = 7000
user = "sahin"
metadatas.token = "{{ .Envs.FRP_GATE_TOKEN }}" # or the token itself

transport.heartbeatInterval = 15
transport.heartbeatTimeout = 60

[[proxies]]
name = "web"
type = "http"
localPort = 3000
customDomains = ["app.pc.sahin.dev.example.com"]
requestHeaders.set.x-forwarded-proto = "https"
```

- **Heartbeats are required.** frpc turns them off by default when tcpMux is on. frps (with
  `transport.heartbeatTimeout = 60`) drops a session that sends none, so leaving these lines out
  means the client is cut off every minute.
- **Use `customDomains` with full names.** `subdomain` is refused (see
  [DESIGN.md](DESIGN.md#subdomain-or-customdomains)). frp wildcards such as `*.pc.sahin.dev.example.com`
  work if the whole wildcard is granted.
- **Proxy types:** `http`, `https`, `tcpmux` (names) and `tcp`, `udp` (an explicit `remotePort`).
  `stcp`, `xtcp` and `sudp` are refused in v1.
- `requestHeaders.set.x-forwarded-proto` is optional; frps does not pass Caddy's header on, and
  many apps need it to build `https://` links.
- With [docker-frp](../docker-frp) as the client, mount the file as `/app/configs/frpc.toml` and
  pass the token as an environment variable as above, so it does not appear in the printed config.

## Concepts

| Concept | What it is |
| --- | --- |
| **Zone** | A base domain pointed at the gateway, e.g. `dev.videochat.example.com`. |
| **Server** | An frps that uses frp-gate as its plugin, and the zones it may serve. |
| **Client** | A named token holder: a person or machine (`sahin`, `ertan`, `home-pi`). The name is the frpc `user`. Tokens are random, shown once and stored as a SHA-256 hash. Clients can be disabled, re-enabled, given a new token, or deleted. |
| **Group** | A set of clients, e.g. everyone on project `videochat`. |
| **Grant** | What a client, or every member of a group, may claim: host names matching a pattern in a zone, or a tcp/udp port or range on a server. |

### Host patterns

A pattern is written relative to its zone (or in full). Labels are literal, `{client}`, or (only
leftmost) `*`:

| Pattern in zone `dev.example.com` | `sahin` may use | `sahin` may not use |
| --- | --- | --- |
| `*.{client}` | `app.sahin…`, `api.pc.sahin…`, `*.pc.sahin…` | `sahin.dev.example.com`, `app.ertan…` |
| `{client}` | `sahin.dev.example.com` | `app.sahin…` |
| `status` | `status.dev.example.com` (anyone holding this grant) | anything else |
| `@` | `dev.example.com` itself | |

`*` stands for **one or more** labels of any depth. That is also how frps routes its wildcard
domains. One group grant `*.{client}` gives every member their own subtree.

## Revocation

Disabling a client, rotating its token, or removing a grant takes effect without touching frps:

| Plugin op | What frp-gate does |
| --- | --- |
| **Ping** | Refused for a disabled client, or for a session holding a proxy whose grant is gone. frpc closes the session when the Pong carries the error. If a client ignores that, frps closes the session itself once `heartbeatTimeout` passes without an accepted Ping. |
| **NewWorkConn** | Refused for a disabled client, so it gets no new work connections. |
| **Login** | Refused, so the client cannot reconnect. |
| **TLS ask** | Refused at once for a disabled client's names. |

In practice a disabled client is cut off at its next heartbeat: **within 15 s**, or at most 60 s for
a client that ignores the error. The integration test measures this; see
[DESIGN.md](DESIGN.md#revocation).

### TLS ask modes

`FRP_GATE_ASK_MODE=claimed` (default) approves a name only if it is granted to an enabled client
**and** that client used it in an accepted proxy in the last `FRP_GATE_CLAIM_RETENTION` (30 days).
Without the second condition anyone could make Caddy request certificates for random names under
`*.{client}.<zone>` and use up the ACME rate limits for the domain. `granted` drops that condition.

## Configuration

All settings are environment variables.

| Variable | Default | Meaning |
| --- | --- | --- |
| `FRP_GATE_ADMIN_PASSWORD` | (required) | Admin UI/API password, at least 12 characters. `FRP_GATE_ADMIN_PASSWORD_FILE` reads it from a file. |
| `FRP_GATE_INSTANCE_KEY` | (none) | If set, a server named `FRP_GATE_INSTANCE_NAME` uses this plugin key (at least 32 characters). This lets frps.toml be written before frp-gate first starts. `_FILE` variant supported. |
| `FRP_GATE_INSTANCE_NAME` | `default` | Name of that server. |
| `FRP_GATE_INSTANCE_SERVER_ADDR` | (empty) | `host:port` frpc clients connect to; used in frpc.toml snippets. |
| `FRP_GATE_DB` | `/data/frp-gate.db` | SQLite file. Back it up. |
| `FRP_GATE_INTERNAL_ADDR` | `:7600` | Listener for the frps plugin, `/tls/ask` and `/healthz`. Keep it private. |
| `FRP_GATE_ADMIN_ADDR` | `:7601` | Listener for the admin UI and API. Put HTTPS (Caddy) in front. |
| `FRP_GATE_PLUGIN_ADDR` | `frp-gate:7600` | How frps reaches frp-gate; used in frps.toml snippets. |
| `FRP_GATE_ASK_MODE` | `claimed` | `claimed` or `granted`; see [TLS ask modes](#tls-ask-modes). |
| `FRP_GATE_CLAIM_RETENTION` | `720h` | How long a used name stays approved for the TLS ask. |
| `FRP_GATE_SESSION_TIMEOUT` | `90s` | A session counts as connected if it sent a heartbeat this recently. |
| `FRP_GATE_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`. Decisions to refuse are logged at `info`. |

Ports: **7600** (internal: plugin, ask, health) and **7601** (admin). The image has a `HEALTHCHECK`
(`frp-gate healthcheck`).

## JSON API

Under `/api/v1/` on the admin listener, with HTTP Basic auth (any user name, the admin password).
Objects are addressed by name.

| Method and path | Body / result |
| --- | --- |
| `GET status` | connected sessions with their proxies |
| `GET clients`, `GET clients/{name}` | clients; one client with its grants and frpc.toml |
| `POST clients` | `{"name","note","groups":[]}` → `{"client","token","frpc_toml"}` |
| `POST clients/{name}/disable` · `/enable` · `/rotate` | rotate returns the new `token` |
| `DELETE clients/{name}` | |
| `GET zones`, `POST zones`, `DELETE zones/{domain}` | `{"domain"}` |
| `GET instances`, `POST instances` | `{"name","server_addr","zones":[]}` → `{"instance","key","frps_toml"}` |
| `PUT instances/{name}/zones`, `POST instances/{name}/rotate`, `DELETE instances/{name}` | `{"zones":[]}` |
| `GET groups`, `POST groups`, `DELETE groups/{name}` | `{"name"}` |
| `PUT` / `DELETE groups/{name}/members/{client}` | |
| `GET grants`, `POST grants`, `DELETE grants/{id}` | see below |

```bash
api() { curl -fsS -u "admin:$FRP_GATE_ADMIN_PASSWORD" -H 'Content-Type: application/json' "https://gate.example.com/api/v1/$@"; }
api zones -d '{"domain":"dev.example.com"}'
api grants -d '{"group":"videochat","kind":"host","zone":"dev.example.com","pattern":"*.{client}"}'
api grants -d '{"client":"home-pi","kind":"port","instance":"default","proto":"tcp","ports":"25565"}'
api clients -d '{"name":"ertan","groups":["videochat"]}'
api clients/ertan/disable -X POST
```

## Several frps instances

One frps serves every zone; grants keep clients apart. You can still point several frps at one
frp-gate, for example one per network or region. Add a server under **Servers** (or
`POST /api/v1/instances`). Each server gets its own key in its plugin path and serves only the zones
ticked for it. Host grants count only in those zones, and port grants belong to one server.

## Development

Go is not needed locally: builds and tests run in Docker.

```bash
pnpm nx run frp-gate:test                          # go vet + unit tests (docker build --target test)
pnpm nx run frp-gate:test-integration              # real frps + frpc + frp-gate (frp 0.65.0)
pnpm nx run frp-gate:test-integration:latest-frp   # same against frp 0.72.0
pnpm nx run frp-gate:build                         # image telperiontech/frp-gate:latest
pnpm nx run frp-gate:run                           # admin UI on http://localhost:7601
```

The integration test is a bash script. On Windows run it from Git Bash; in PowerShell, `bash` is
usually WSL's, which does not see Docker Desktop the same way.

Layout: `cmd/frp-gate` (main), `internal/pattern` (host patterns), `internal/policy` (all
decisions), `internal/frpplugin` (frps plugin protocol, frp's own types), `internal/ask`,
`internal/admin` (UI, API), `internal/store` (SQLite), `test/integration`.

### Release

Publish a GitHub release whose tag is `frp-gate-vX.Y.Z`:

```bash
gh release create frp-gate-v0.1.0 --title "frp-gate v0.1.0" --notes "..."
```

[`frp-gate.publish.yml`](../../.github/workflows/frp-gate.publish.yml) runs the unit and integration
tests and pushes `ghcr.io/telperiontech/frp-gate:X.Y.Z` and `:latest` for amd64 and arm64.

## License

[Apache 2.0](LICENSE)
