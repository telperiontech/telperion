# Repository Agent Guidelines

These rules apply to any AI agent (Copilot, Claude, etc.) working in this repository, in addition to anything declared in `.github/instructions/`.

## File Size & Separation of Concerns

- **Keep files small and focused.** A file should do one thing well.
- **Split files when they grow.** When a single file accumulates multiple unrelated concerns (parsing, rendering, lifecycle, utilities, types, …), extract each concern into its own sibling module.
- **Prefer many small siblings over one large file.** Co-locate split modules next to their consumer (e.g. `popover/position.ts` next to `popover/popover-element.ts`).
- Keep public exports surfaced through the package/folder `index.ts` so consumers are unaffected by internal splits.
- Apply the same rule to tests, stories, and docs: split them whenever they outgrow a single focused topic.

When in doubt, split.

## Local Dev Ports

Local dev servers use this repo's block, 10500-10599, from the owner's port registry (self-host repo, `docs/dev-ports.md`), so they run next to other projects. osw apps 10500+ (shell 10500, home 10501), messenger demo 10502-10503, Beacon 10504-10506 (UI dev server 10504, admin 10505, ingest 10506), docs apps 10522-10539 (10531 reserved for Beacon's docs app), Verdaccio 10550, Storybooks 10560-10563. Never use a framework default port (4200, 5173, 6006); give a new dev server the next free port in its range and add it to the registry.

## osw Dev Environment

The osw apps are reached locally through frp-gate tunnels at `https://[<remote>.]<device>.<user>.<OSW_DEV_ZONE>`, never through a hosts file, self-signed certificates or `*.local` names; see `docs/OSW-DEVELOPMENT.md`. The developer identity (incl. the frp-gate token) lives in the gitignored `.workspace/dev.env`: never print, commit or copy the token, and validate the compose file with `docker compose config --quiet` (plain `config` prints it). The frp-gate server, the dev zone and the developer names are per deployment and come only from that file (`@osw/build` `readDevIdentity`): this is an open-source repo, so never commit a real gateway, zone, client name or personal domain; use `example.com` names and placeholders such as `alice` in code, docs and examples. Only the osw dev servers are tunnelled.
