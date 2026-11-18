/**
 * Prints the Firebase Hosting config of an osw app (used by .github/workflows/osw-deploy.yml).
 *
 * Environment:
 *   SITE          Firebase Hosting site, e.g. `osw-js-utils`
 *   PUBLIC_DIR    built app folder, e.g. `dist/osw/js-utils`
 *   CORS_ORIGIN   origin allowed to load the app's files (federated remotes); empty for the shell
 *   NO_CACHE      extra `|`-separated root files to revalidate on every load, e.g. `preview/index.html`
 *
 * Usage: SITE=… PUBLIC_DIR=… node apps/osw/kit/build/scripts/firebase-json.mjs > firebase.json
 */
const { SITE, PUBLIC_DIR, CORS_ORIGIN = '', NO_CACHE = '' } = process.env;

if (!SITE || !PUBLIC_DIR) {
	console.error('SITE and PUBLIC_DIR are required');
	process.exit(1);
}

/** Federation entry points must never be served stale, or the shell loads an outdated remote */
const noCacheFiles = ['mf-manifest.json', 'mf-stats.json', 'remoteEntry.js', ...NO_CACHE.split('|').filter(Boolean)];

const headers = [
	CORS_ORIGIN && {
		source: '**',
		headers: [
			{ key: 'Access-Control-Allow-Origin', value: CORS_ORIGIN },
			{ key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
			{ key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
		],
	},
	{
		source: '**/*.@(js|css|woff2|woff|ttf)',
		headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
	},
	{
		source: `/@(${noCacheFiles.join('|')})`,
		headers: [{ key: 'Cache-Control', value: 'no-cache' }],
	},
].filter(Boolean);

const config = {
	hosting: {
		site: SITE,
		public: PUBLIC_DIR,
		ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
		rewrites: [{ source: '**', destination: '/index.html' }],
		headers,
	},
};

console.log(JSON.stringify(config, null, 2));
