export interface Library {
	name: string;
	description: string;
	category: string;
	emoji: string;
	gradient: string;
	hoverGradient: string;
	packageName: string;
	type: 'npm' | 'docker';
	/** GHCR image path (`owner/name`), required for docker libraries */
	image?: string;
}

export const libraries: Library[] = [
	{
		name: '@telperion/js-utils',
		description: 'Comprehensive JavaScript utility functions for web development. Tree-shakeable, zero dependencies, high performance utilities with full TypeScript support.',
		category: 'JavaScript',
		emoji: '✨',
		gradient: 'from-primary-400 via-primary-500 to-primary-700',
		hoverGradient: 'hover:from-primary-500 hover:via-primary-600 hover:to-primary-800',
		packageName: 'js-utils',
		type: 'npm'
	},
	{
		name: '@thalesrc/ts-utils',
		description: 'Advanced TypeScript utility functions and helper methods. Simplify complex operations with type-safe utilities designed for modern TypeScript projects.',
		category: 'TypeScript',
		emoji: '🎯',
		gradient: 'from-secondary-400 via-secondary-500 to-secondary-700',
		hoverGradient: 'hover:from-secondary-500 hover:via-secondary-600 hover:to-secondary-800',
		packageName: 'ts-utils',
		type: 'npm'
	},
	{
		name: '@telperion/extra-ts-types',
		description: 'Extra TypeScript utility types for advanced type manipulation and better type safety. Expand your type toolkit with powerful type utilities.',
		category: 'TypeScript',
		emoji: '🔷',
		gradient: 'from-secondary-500 via-primary-500 to-tertiary-500',
		hoverGradient: 'hover:from-secondary-600 hover:via-primary-600 hover:to-tertiary-600',
		packageName: 'extra-ts-types',
		type: 'npm'
	},
	{
		name: '@thalesrc/react-utils',
		description: 'Production-ready React hooks and utility components. Simplify your React development with reusable, well-tested hooks and components.',
		category: 'React',
		emoji: '⚛️',
		gradient: 'from-tertiary-400 via-tertiary-500 to-tertiary-700',
		hoverGradient: 'hover:from-tertiary-500 hover:via-tertiary-600 hover:to-tertiary-800',
		packageName: 'react-utils',
		type: 'npm'
	},
	{
		name: '@telperion/rx-utils',
		description: 'Powerful RxJS utilities and operators. Convert Observables to AsyncIterables, create custom operators, and streamline reactive programming.',
		category: 'RxJS',
		emoji: '🌊',
		gradient: 'from-quaternary-400 via-quaternary-500 to-quaternary-700',
		hoverGradient: 'hover:from-quaternary-500 hover:via-quaternary-600 hover:to-quaternary-800',
		packageName: 'rx-utils',
		type: 'npm'
	},
	{
		name: '@telperion/dom-utils',
		description: 'Essential DOM manipulation and query utilities. Simplify browser interactions with intuitive helper functions for modern web development.',
		category: 'Browser',
		emoji: '🎨',
		gradient: 'from-success-400 via-success-500 to-success-700',
		hoverGradient: 'hover:from-success-500 hover:via-success-600 hover:to-success-800',
		packageName: 'dom-utils',
		type: 'npm'
	},
	{
		name: '@telperion/elements',
		description: 'Framework-agnostic web components built with Lit. Declarative router, CSS-anchored popover, form-associated select and button, drag-and-drop primitives, and icon sets.',
		category: 'Web Components',
		emoji: '🧩',
		gradient: 'from-primary-500 via-quaternary-500 to-warning-500',
		hoverGradient: 'hover:from-primary-600 hover:via-quaternary-600 hover:to-warning-600',
		packageName: 'elements',
		type: 'npm'
	},
	{
		name: '@telperion/ng-pack',
		description: 'Angular utilities organized as secondary entry points. Signal-based storage, SSE client with interceptors, event modifier plugins, and more for modern Angular apps.',
		category: 'Angular',
		emoji: '🅰️',
		gradient: 'from-danger-400 via-secondary-500 to-primary-600',
		hoverGradient: 'hover:from-danger-500 hover:via-secondary-600 hover:to-primary-700',
		packageName: 'ng-pack',
		type: 'npm'
	},
	{
		name: '@telperion/ng-ui',
		description: 'Angular UI element library with form, field, and other reusable building blocks. Organized as secondary entry points and Tailwind v4 friendly.',
		category: 'Angular',
		emoji: '🧱',
		gradient: 'from-secondary-400 via-danger-500 to-warning-500',
		hoverGradient: 'hover:from-secondary-500 hover:via-danger-600 hover:to-warning-600',
		packageName: 'ng-ui',
		type: 'npm'
	},

	{
		name: '@thalesrc/node-utils',
		description: 'Server-side Node.js utilities for backend development. Streamline server operations with battle-tested helper functions.',
		category: 'Node.js',
		emoji: '🚀',
		gradient: 'from-danger-400 via-danger-500 to-danger-700',
		hoverGradient: 'hover:from-danger-500 hover:via-danger-600 hover:to-danger-800',
		packageName: 'node-utils',
		type: 'npm'
	},
	{
		name: '@telperion/messenger',
		description: 'JavaScript messaging library for cross-context communication. Enable seamless message passing between iframes, workers, windows, and browser extensions.',
		category: 'Communication',
		emoji: '📡',
		gradient: 'from-primary-500 via-secondary-500 to-tertiary-500',
		hoverGradient: 'hover:from-primary-600 hover:via-secondary-600 hover:to-tertiary-600',
		packageName: 'messenger',
		type: 'npm'
	},
	{
		name: '@telperion/reactive-storage',
		description: 'Reactive storage solutions for modern applications. Build reactive data persistence layers with observable storage patterns.',
		category: 'Storage',
		emoji: '💾',
		gradient: 'from-secondary-500 via-tertiary-500 to-quaternary-500',
		hoverGradient: 'hover:from-secondary-600 hover:via-tertiary-600 hover:to-quaternary-600',
		packageName: 'reactive-storage',
		type: 'npm'
	},
	{
		name: '@telperion/paintlet',
		description: 'CSS Paint API utilities for creating custom paint worklets. Unlock the power of CSS Houdini for dynamic, performant graphics.',
		category: 'Browser',
		emoji: '🖌️',
		gradient: 'from-tertiary-500 via-quaternary-500 to-success-500',
		hoverGradient: 'hover:from-tertiary-600 hover:via-quaternary-600 hover:to-success-600',
		packageName: 'paintlet',
		type: 'npm'
	},
	{
		name: '@thalesrc/nx-utils',
		description: 'Nx monorepo utilities and custom executors. Enhance your Nx workspace with powerful build tools and development workflows.',
		category: 'Tooling',
		emoji: '🔧',
		gradient: 'from-quaternary-500 via-warning-500 to-danger-500',
		hoverGradient: 'hover:from-quaternary-600 hover:via-warning-600 hover:to-danger-600',
		packageName: 'nx-utils',
		type: 'npm'
	},
	{
		name: '@telperion/auto-proxy',
		description: 'Docker-aware nginx reverse proxy with automatic SSL and service discovery. Perfect for development environments with gRPC and database support.',
		category: 'DevOps',
		emoji: '🔌',
		gradient: 'from-primary-500 via-tertiary-500 to-success-500',
		hoverGradient: 'hover:from-primary-600 hover:via-tertiary-600 hover:to-success-600',
		packageName: 'auto-proxy',
		type: 'docker',
		image: 'telperiontech/auto-proxy'
	},
	{
		name: '@thalesrc/docker-frp',
		description: 'Fast Reverse Proxy container with server and client modes. Features web GUI for configuration, TLS support, and built-in health monitoring.',
		category: 'DevOps',
		emoji: '🐳',
		gradient: 'from-tertiary-500 via-success-500 to-primary-500',
		hoverGradient: 'hover:from-tertiary-600 hover:via-success-600 hover:to-primary-600',
		packageName: 'docker-frp',
		type: 'docker',
		image: 'thalesrc/docker-frp'
	}
];
