export type EcosystemId = 'core' | 'browser' | 'frameworks' | 'node' | 'docker';

export interface Ecosystem {
	id: EcosystemId;
	label: string;
	blurb: string;
}

export const ecosystems: Ecosystem[] = [
	{ id: 'core', label: 'Core', blurb: 'Language-level utilities and types for JavaScript and TypeScript.' },
	{ id: 'browser', label: 'Browser', blurb: 'Web components, DOM helpers and cross-context messaging.' },
	{ id: 'frameworks', label: 'Frameworks', blurb: 'Building blocks for React and Angular applications.' },
	{ id: 'node', label: 'Node & Tooling', blurb: 'Server-side helpers and Nx workspace executors.' },
	{ id: 'docker', label: 'Docker', blurb: 'Ready-to-run containers for development infrastructure.' },
];

export const ecosystemById = (id: EcosystemId): Ecosystem => {
	const ecosystem = ecosystems.find((e) => e.id === id);
	if (!ecosystem) throw new Error(`Unknown ecosystem: ${id}`);
	return ecosystem;
};
