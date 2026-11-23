import type { TargetConfiguration } from '@nx/devkit';

export interface DocsRemote {
	/** Nx project name, e.g. `osw/js-utils` */
	name: string;
	/** Workspace-relative project root, e.g. `libs/js-utils/docs-app` */
	root: string;
	/** Workspace-relative generator script, when the remote builds a docs model */
	modelScript?: string;
}

const webpackConfigurations = {
	development: {
		extractLicenses: false,
		optimization: false,
		sourceMap: true,
		vendorChunk: true,
	},
	production: {
		fileReplacements: [],
		optimization: true,
		outputHashing: 'all',
		sourceMap: false,
		namedChunks: false,
		extractLicenses: true,
		vendorChunk: false,
	},
};

/**
 * Standard targets of an osw docs remote. A remote's project.json only adds what differs
 * (at least `serve/app.options.port`); its targets are merged over these.
 */
export function docsRemoteTargets({ name, root, modelScript }: DocsRemote): Record<string, TargetConfiguration> {
	const model = modelScript ? ['generate-model'] : [];
	const targets: Record<string, TargetConfiguration> = {
		serve: {
			executor: '@thalesrc/nx-utils:run-parallel',
			// The frp-gate tunnel (`nx run osw:mediator`) is started separately, so serving works without Docker
			dependsOn: [...model],
			options: {
				commands: [
					{ command: `nx run ${name}:build/tailwind-config -- --watch`, readyWhen: 'Sass is watching for changes' },
					`nx run ${name}:serve/app`,
				],
			},
		},
		'serve/app': {
			executor: '@nx/webpack:dev-server',
			defaultConfiguration: 'development',
			options: {
				buildTarget: `${name}:build/app`,
				// Public host and HMR socket come from .workspace/dev.env (configureDevServer in @osw/build)
				host: '0.0.0.0',
			},
			configurations: {
				development: { buildTarget: `${name}:build/app:development` },
				production: { buildTarget: `${name}:build/app:production` },
			},
		},
		build: {
			dependsOn: [...model, 'build/tailwind-config', 'build/app'].map((target) => `${name}:${target}`),
		},
		'build/app': {
			executor: '@nx/webpack:webpack',
			outputs: ['{options.outputPath}'],
			defaultConfiguration: 'production',
			dependsOn: [...model, 'build/tailwind-config'],
			inputs: ['default', '^default', { env: 'PACKAGE_VERSION' }],
			options: {
				compiler: 'babel',
				outputPath: `dist/${name}`,
				baseHref: '/',
				main: `${root}/src/main.tsx`,
				tsConfig: `${root}/tsconfig.app.json`,
				assets: [`${root}/src/assets`],
				postcssConfig: 'apps/osw/kit/build/postcss.config.cjs',
				webpackConfig: `${root}/webpack.config.ts`,
			},
			configurations: webpackConfigurations,
		},
		'build/tailwind-config': {
			executor: 'nx:run-commands',
			options: {
				command: `sass apps/osw/kit/tokens/tailwind.config.scss ${root}/src/styles/tailwind.config.css`,
			},
		},
	};

	if (modelScript) {
		targets['generate-model'] = {
			executor: 'nx:run-commands',
			inputs: ['{projectRoot}/../src/**/*.ts', '{projectRoot}/scripts/**/*.ts', '{workspaceRoot}/apps/osw/kit/api/generator/**/*.ts', { env: 'PACKAGE_VERSION' }],
			outputs: ['{projectRoot}/src/generated'],
			options: {
				command: `node -r @swc-node/register ${modelScript} --strict`,
			},
		};
	}

	return targets;
}
