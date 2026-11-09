# osw/shell — environment variables

This file explains the small local developer setup for environment variables used by the `osw/shell` app.

Copy the template and fill in the values (each variable is documented inside it):

```bash
cp apps/osw/shell/.env.template apps/osw/shell/.env
```

- `OSW_HOME_URL`: base URL of the `osw/home` remote (`https://home.open-source.telperion.local` locally).
- `GOOGLE_ANALYTICS_ID`: your Google Analytics measurement ID (for example `G-XXXXXXXXXX`); optional locally.
- Do NOT commit your local `.env` to git. Add `apps/osw/shell/.env` to your `.gitignore` if it is not already ignored.

How the app reads these values
- In the application TypeScript code the variables are available via `import.meta.env`:

```ts
const home = import.meta.env.OSW_HOME_URL;
const ga = import.meta.env.GOOGLE_ANALYTICS_ID;
```

- If your editor/TypeScript doesn't pick up `import.meta.env` types, restart the TypeScript server (VS Code: "TypeScript: Restart TS Server"). The available keys are declared in `apps/osw/shell/src/global.d.ts`.

Running the app
- Start the app in development with Nx (use pnpm):

```bash
pnpm nx run osw/shell:serve
```

Notes and troubleshooting
- This README assumes you will provide the `.env` file locally. If you need these variables to be injected at build-time or at runtime from a different source (CI, runtime config), add the appropriate webpack or runtime-injection step.
- Keep secrets out of client bundles. Only public (non-sensitive) IDs should be put in `.env` used by browser code. If a value is secret, prefer a server-side endpoint.
