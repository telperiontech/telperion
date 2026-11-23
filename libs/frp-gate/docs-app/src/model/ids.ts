/** Anchor id of an example file on the examples page (`frps/frps.toml` → `frps-frps-toml`). React-free */
export const exampleId = (path: string) =>
	path
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

/** Anchor id of an API route (`POST clients/{name}/{action}` → `post-clients-name-action`) */
export const routeId = (method: string, path: string) => exampleId(`${method} ${path}`);
