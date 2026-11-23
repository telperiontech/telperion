# osw local development

The osw site (`apps/osw`: the shell, home and the docs remotes in `libs/*/docs-app`) runs locally behind
**frp-gate** tunnels. Each dev server runs on your machine. A small frpc container publishes it as a public
HTTPS name with a real certificate, so the shell loads its remotes cross-origin exactly as in production.
There is no hosts file, no self-signed certificate and no local reverse proxy on ports 80 and 443.

## How it works

Your **base domain** is `<DEV_DEVICE>.<FRP_GATE_USER>.<OSW_DEV_ZONE>`. For example, the user `alice` on
the device `pc`, in the zone `dev.example.com`, gets `pc.alice.dev.example.com`.

The frp-gate server, the zone and your client name come from whoever runs the frp-gate you use (see
[Running your own frp-gate](#running-your-own-frp-gate)). They are not in the repo; you keep them in
`.workspace/dev.env`.

| App | Local dev server | Public URL |
| --- | --- | --- |
| shell (`osw/shell`) | `localhost:10500` | `https://<base>` |
| home (`osw/home`) | `localhost:10501` | `https://home.<base>` |
| docs remote `osw/<name>` | `localhost:105xx` (its `serve/app` port) | `https://<name>.<base>` |

`nx run osw:status` prints your exact list.

- The frpc container logs in to the frp-gate server (`FRP_GATE_SERVER_ADDR`:`FRP_GATE_SERVER_PORT`) with your
  client name and token from `.workspace/dev.env`. Only you can claim names under `*.<you>.<OSW_DEV_ZONE>`.
- TLS ends at the gateway. frpc forwards plain HTTP to the dev servers with `X-Forwarded-Proto: https`.
- The proxy list comes from the Nx workspace: every `scope:osw` project with a `serve/app` port.
  `nx run osw:mediator` writes it to `apps/osw/.mediator/frpc.toml` (gitignored, placeholders only).
- The shell loads each remote from `https://<name>.<base>`. `generate-remotes` derives this from
  `.workspace/dev.env` unless `OSW_DOMAIN` is set in `apps/osw/shell/.env`.
- The dev servers accept every host in the zone. `configureDevServer` in `@osw/build` points their
  webpack socket at `wss://<host>:443`.

Every URL is public on the internet. Only the osw dev servers are tunnelled. Never add anything else to the
tunnel.

## One-time setup

1. Get from your frp-gate admin: the server address and port, the osw dev zone, your client name and your
   token. The token is shown once.
2. Copy `.workspace/dev.env.example` to `.workspace/dev.env` and fill in `FRP_GATE_SERVER_ADDR`,
   `FRP_GATE_SERVER_PORT`, `OSW_DEV_ZONE`, `FRP_GATE_USER`, `DEV_DEVICE` and `FRP_GATE_TOKEN`. The file is
   gitignored. Never commit it, and never paste the token anywhere else.
3. Run `pnpm install`.
4. Optional: copy `apps/osw/shell/.env.template` to `apps/osw/shell/.env`. Leave `OSW_DOMAIN` empty.

## Every day

```bash
pnpm nx run osw:mediator   # start or refresh the tunnel (Docker)
pnpm nx run osw:serve      # start the shell and every remote
pnpm nx run osw:status     # check the tunnel and each URL
```

Then open `https://<base>`.

- The first request for each name takes a few seconds, because the gateway gets its certificate then.
  After that, requests are fast.
- Testing from a phone or another network just works: the URLs are public and use real HTTPS.
- `nx run osw:mediator/logs` follows frpc's log, and `nx run osw:mediator/stop` stops it.
- The mediator and the dev servers are independent. Serving works without Docker; you only get the
  public URLs while frpc runs.

## Two devices at once

Give each machine its own `DEV_DEVICE` (`pc`, `mac`, …) and keep the same user and token. Each machine
then has its own base domain, for example `pc.alice.…` and `mac.alice.…`.

## Adding a remote

Give the new project a free `serve/app` port in the repo's 10500-10599 block (see `AGENTS.md`), then run
`nx run osw:mediator` again so frpc gets its proxy. Nothing else in the dev setup changes. The other
steps are in `apps/osw/shell/README.md`.

## Working on the shell alone

Set `OSW_DOMAIN=open-source.telperion.tr` in `apps/osw/shell/.env` to load the production remotes. Empty
it again to load your own remotes.

## When something fails

Run `nx run osw:status`. It shows frpc's recent errors.

| Symptom | Cause and fix |
| --- | --- |
| `Missing .workspace/dev.env` | Do step 2 of the one-time setup. |
| "not granted" | The name is outside `*.<you>.<OSW_DEV_ZONE>`. Check `FRP_GATE_USER` and `OSW_DEV_ZONE`. |
| login refused, "invalid token" | `FRP_GATE_TOKEN` is wrong or your client is disabled. Ask the admin. |
| "proxy already exists" | Another machine uses the same `DEV_DEVICE`. Give each device its own name. |
| A URL answers 502 | The tunnel works, but that dev server is not running. Start `nx run osw:serve`. |
| TLS error on a URL | Your frpc has not claimed that name. Check the tunnel section of `osw:status`. |
| A new remote has no URL | Run `nx run osw:mediator` again. |
| You edited `dev.env` | Run `nx run osw:mediator`, then restart `nx run osw:serve`. |

## Running your own frp-gate

Without access to an existing frp-gate, run your own on a server with a public IP: frps, frp-gate and
Caddy, as described in [libs/frp-gate](../libs/frp-gate/README.md). Then:

1. Point a wildcard DNS record for your zone at the server, for example `*.dev.example.com`.
2. Add the zone to frp-gate, create a client for each developer, and give them (or a group) the host
   grant `*.{client}` in that zone.
3. Give each developer the server address and port, the zone, their client name and their token for
   their `.workspace/dev.env`.

## Moving from the old gateway

The old setup was an auto-proxy container with self-signed certificates for
`*.open-source.telperion.local`. To clean it up once:

- The first `nx run osw:mediator` removes the old `gateway` container. It runs with `--remove-orphans`
  in the same compose project, `osw`.
- Delete its volume: `docker volume rm osw_gateway_dhparam`.
- Delete `apps/osw/.certs`. Also remove that certificate from your OS trust store if you added it there.
- Remove any `*.open-source.telperion.local` lines from your hosts file.
- If `apps/osw/shell/.env` still says `OSW_DOMAIN=open-source.telperion.local`, empty it.
