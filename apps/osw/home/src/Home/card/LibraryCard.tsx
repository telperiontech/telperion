import { registryUrl, sourceUrl, type Library } from '../data';
import { AppLink, ecosystemTones, ExternalLink, Icon } from '../ui';
import { InstallLine } from './InstallLine';
import { LibraryMeta } from './LibraryMeta';

interface LibraryCardProps {
	library: Library;
}

const secondaryLink = 'relative z-10 inline-flex items-center gap-1.5 text-neutral-920 hover:text-secondary-800 transition-colors';

export function LibraryCard({ library }: LibraryCardProps) {
	const isNpm = library.type === 'npm';
	const tone = ecosystemTones[library.ecosystem];

	return (
		<article
			className={`group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-neutral-100 bg-white p-5 transition-[border-color,box-shadow] hover:shadow-lg hover:shadow-secondary-500/10 ${tone.hoverBorder}`}
		>
			{/* Ecosystem-colored bar, revealed on hover */}
			<div
				aria-hidden="true"
				className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${tone.bar}`}
			/>

			<div className="flex items-start gap-3">
				<div className={`grid size-10 shrink-0 place-items-center rounded-lg border ${tone.tile}`}>
					<Icon name={library.icon} size={22} />
				</div>
				<div className="min-w-0 flex-1">
					{/* Stretched link: the whole card opens the library's README/source */}
					<ExternalLink
						href={sourceUrl(library)}
						className="block truncate font-mono text-sm font-semibold text-neutral-990 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-secondary-600"
					>
						{library.name}
					</ExternalLink>
					<p className="mt-0.5 text-sm text-neutral-920">{library.tagline}</p>
				</div>
			</div>

			<p className="flex-1 text-sm leading-relaxed text-neutral-920">{library.description}</p>

			<LibraryMeta library={library} />
			<InstallLine library={library} />

			<div className="flex gap-4 text-xs font-medium">
				{library.docsPath && (
					<AppLink href={library.docsPath} className={secondaryLink}>
						<Icon name="menu_book" size={14} />
						Docs
					</AppLink>
				)}
				<ExternalLink href={registryUrl(library)} className={secondaryLink}>
					{isNpm ? <Icon brand="npm" size={14} /> : <Icon brand="docker" size={14} />}
					{isNpm ? 'npm' : 'GHCR'}
				</ExternalLink>
				<ExternalLink href={sourceUrl(library)} className={secondaryLink}>
					<Icon brand="github" size={14} />
					Source
				</ExternalLink>
			</div>
		</article>
	);
}
