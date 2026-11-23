# osw/shell — environment variables

This file explains the small local developer setup for environment variables used by the `osw/shell` app.

Copy the template and fill in the values (each variable is documented inside it):

```bash
cp apps/osw/shell/.env.template apps/osw/shell/.env
```

- `OSW_DOMAIN`: domain the remotes are served under (`open-source.telperion.local` locally). Each remote listed in `config/remotes.json` is loaded from `https://<name>.<OSW_DOMAIN>`.
- `GOOGLE_ANALYTICS_ID`: your Google Analytics measurement ID (for example `G-XXXXXXXXXX`); optional locally. When empty, gtag and the consent banner are not loaded. In CI it comes from the `GOOGLE_ANALYTICS_ID` repository variable (see `src/analytics/`).
- Do NOT commit your local `.env` to git. Add `apps/osw/shell/.env` to your `.gitignore` if it is not already ignored.

How the app reads these values
- In the application TypeScript code the variables are available via `import.meta.env`:

```ts
const ga = import.meta.env.GOOGLE_ANALYTICS_ID;
```

- If your editor/TypeScript doesn't pick up `import.meta.env` types, restart the TypeScript server (VS Code: "TypeScript: Restart TS Server"). The available keys are declared in `apps/osw/shell/src/global.d.ts`.

Running the app
- Start the shell and every remote (dev servers on ports 10500+) with Nx (use pnpm):

```bash
pnpm nx run osw:serve
```

- The apps are reached through the local HTTPS gateway (`https://<name>.open-source.telperion.local`), a Docker container that `serve` does not start, so you can switch between projects' gateways freely. Start or refresh it when needed (also after adding a remote, so it proxies the new port):

```bash
pnpm nx run osw:mediator
```

Notes and troubleshooting
- This README assumes you will provide the `.env` file locally. If you need these variables to be injected at build-time or at runtime from a different source (CI, runtime config), add the appropriate webpack or runtime-injection step.
- Keep secrets out of client bundles. Only public (non-sensitive) IDs should be put in `.env` used by browser code. If a value is secret, prefer a server-side endpoint.

## Adding a remote

Remotes are listed once, in `config/remotes.json`. From that list the shell inserts each remote's `<tp-route>` (`src/remotes`), defines its `<osw-<name>>` element, and generates `src/assets/module-federation.manifest.json` and `robots.txt` (`nx run osw/shell:generate-remotes`). A remote `<name>` is loaded from `https://<name>.<OSW_DOMAIN>` and mounted at `/<name>`.

For a new docs remote (Nx project `osw/<name>`):

1. Create the project with the `type:docs-app` tag. Its serve, build and generate-model targets are inferred by `apps/osw/kit/build/src/nx-plugin`, so `project.json` only needs a free `serve/app.options.port`. The local gateway (`nx run osw:mediator`) and `nx run osw:serve` pick it up automatically.
2. For a TypeScript library's API reference, use `@osw/api`: a `scripts/generate-docs-model.ts` calling `generateApiModel`, a `Docs.tsx` rendering `<ApiDocsRoot>`, and an overview page (see `libs/ts-utils/docs-app`).
3. Add `{ "name": "<name>" }` to `config/remotes.json`.
4. Add `.github/workflows/osw-<name>.publish.yml` calling `osw-deploy.yml`, and create the `osw-<name>` Firebase Hosting site and DNS for `<name>.open-source.telperion.tr`.
