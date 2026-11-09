import type { EcosystemId } from './ecosystems';

export interface Library {
	/** Published package name, including its current scope */
	name: string;
	/** Folder name under `libs/` in the monorepo */
	packageName: string;
	tagline: string;
	description: string;
	ecosystem: EcosystemId;
	/** Material Symbols glyph */
	icon: string;
	type: 'npm' | 'docker';
	/** GHCR image path (`owner/name`), required for docker libraries */
	image?: string;
}

export const libraries: Library[] = [
	{
		name: '@telperion/js-utils',
		packageName: 'js-utils',
		tagline: 'Tree-shakeable JavaScript utilities',
		description: 'Zero-dependency, high-performance helpers for everyday web development, with full TypeScript support.',
		ecosystem: 'core',
		icon: 'function',
		type: 'npm',
	},
	{
		name: '@thalesrc/ts-utils',
		packageName: 'ts-utils',
		tagline: 'Type-safe TypeScript helpers',
		description: 'Utility functions that simplify complex operations while keeping your types precise.',
		ecosystem: 'core',
		icon: 'code',
		type: 'npm',
	},
	{
		name: '@telperion/extra-ts-types',
		packageName: 'extra-ts-types',
		tagline: 'Extra utility types',
		description: 'Advanced type-level tools for type manipulation and stronger type safety.',
		ecosystem: 'core',
		icon: 'category',
		type: 'npm',
	},
	{
		name: '@telperion/rx-utils',
		packageName: 'rx-utils',
		tagline: 'RxJS operators and adapters',
		description: 'Convert Observables to AsyncIterables, build custom operators and streamline reactive code.',
		ecosystem: 'core',
		icon: 'water',
		type: 'npm',
	},
	{
		name: '@telperion/reactive-storage',
		packageName: 'reactive-storage',
		tagline: 'Observable storage',
		description: 'Reactive persistence layers built on observable storage patterns.',
		ecosystem: 'core',
		icon: 'database',
		type: 'npm',
	},
	{
		name: '@telperion/elements',
		packageName: 'elements',
		tagline: 'Framework-agnostic web components',
		description: 'Lit-based router, CSS-anchored popover, form-associated select and button, drag-and-drop and icons.',
		ecosystem: 'browser',
		icon: 'widgets',
		type: 'npm',
	},
	{
		name: '@telperion/dom-utils',
		packageName: 'dom-utils',
		tagline: 'DOM query and manipulation helpers',
		description: 'Intuitive helpers that simplify everyday browser interactions.',
		ecosystem: 'browser',
		icon: 'account_tree',
		type: 'npm',
	},
	{
		name: '@telperion/messenger',
		packageName: 'messenger',
		tagline: 'Cross-context messaging',
		description: 'Message passing between iframes, workers, windows and browser extensions.',
		ecosystem: 'browser',
		icon: 'swap_horiz',
		type: 'npm',
	},
	{
		name: '@telperion/paintlet',
		packageName: 'paintlet',
		tagline: 'CSS Paint API worklets',
		description: 'Build custom CSS Houdini paint worklets for dynamic, performant graphics.',
		ecosystem: 'browser',
		icon: 'brush',
		type: 'npm',
	},
	{
		name: '@thalesrc/react-utils',
		packageName: 'react-utils',
		tagline: 'React hooks and components',
		description: 'Reusable, well-tested hooks and utility components for production React apps.',
		ecosystem: 'frameworks',
		icon: 'animation',
		type: 'npm',
	},
	{
		name: '@telperion/ng-pack',
		packageName: 'ng-pack',
		tagline: 'Angular utilities',
		description: 'Signal-based storage, an SSE client with interceptors, event modifier plugins and more.',
		ecosystem: 'frameworks',
		icon: 'package_2',
		type: 'npm',
	},
	{
		name: '@telperion/ng-ui',
		packageName: 'ng-ui',
		tagline: 'Angular UI building blocks',
		description: 'Form, field and other reusable elements as secondary entry points. Tailwind v4 friendly.',
		ecosystem: 'frameworks',
		icon: 'dashboard',
		type: 'npm',
	},
	{
		name: '@thalesrc/node-utils',
		packageName: 'node-utils',
		tagline: 'Node.js server utilities',
		description: 'Battle-tested helpers that streamline backend operations.',
		ecosystem: 'node',
		icon: 'dns',
		type: 'npm',
	},
	{
		name: '@thalesrc/nx-utils',
		packageName: 'nx-utils',
		tagline: 'Nx executors and tools',
		description: 'Custom executors and build tooling for Nx monorepo workflows.',
		ecosystem: 'node',
		icon: 'build',
		type: 'npm',
	},
	{
		name: '@telperion/auto-proxy',
		packageName: 'auto-proxy',
		tagline: 'Docker-aware nginx reverse proxy',
		description: 'Automatic SSL and service discovery for development environments, with gRPC and database support.',
		ecosystem: 'docker',
		icon: 'router',
		type: 'docker',
		image: 'telperiontech/auto-proxy',
	},
	{
		name: '@thalesrc/docker-frp',
		packageName: 'docker-frp',
		tagline: 'Fast Reverse Proxy container',
		description: 'Server and client modes, with a web GUI for configuration, TLS and built-in health checks.',
		ecosystem: 'docker',
		icon: 'lan',
		type: 'docker',
		image: 'thalesrc/docker-frp',
	},
];
