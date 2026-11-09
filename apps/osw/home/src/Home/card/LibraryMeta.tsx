import type { Library } from '../data';
import { formatCount, useNpmStats } from '../npm';

const pill = 'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs';
const neutralPill = `${pill} bg-neutral-50 text-neutral-920`;
const versionPill = `${pill} bg-tertiary-100 text-tertiary-850`;
const downloadsPill = `${pill} bg-secondary-100 text-secondary-850`;

/** Version and weekly downloads for npm packages; registry label for docker images. */
export function LibraryMeta({ library }: { library: Library }) {
	const stats = useNpmStats(library.type === 'npm' ? library.name : undefined);

	if (library.type === 'docker') {
		return (
			<div className="flex gap-2">
				<span className={neutralPill}>ghcr.io</span>
			</div>
		);
	}

	if (!stats) {
		return (
			<div className="flex gap-2" aria-hidden="true">
				<span className={`${neutralPill} w-14 motion-safe:animate-pulse`}>&nbsp;</span>
				<span className={`${neutralPill} w-16 motion-safe:animate-pulse`}>&nbsp;</span>
			</div>
		);
	}

	return (
		<div className="flex gap-2">
			{stats.version && <span className={versionPill}>v{stats.version}</span>}
			{stats.weeklyDownloads !== undefined && (
				<span className={downloadsPill} title={`${stats.weeklyDownloads.toLocaleString('en')} downloads last week`}>
					{formatCount(stats.weeklyDownloads)}/wk
				</span>
			)}
		</div>
	);
}
