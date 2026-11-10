import { CopyButton, ExternalLink, Icon } from '@osw/react';
import { INSTALL_COMMAND, PACKAGE_NAME } from '../meta';
import { paintletPath, SOURCE_URL } from '../routing';
import { paintlets } from '../stories';
import { heroBackdropStyle, heroVisualStyle } from './hero-styles';

export function Hero() {
	const firstPaintlet = paintlets[0];

	return (
		<section className="relative overflow-hidden border-b border-neutral-100 bg-white" style={heroBackdropStyle}>
			<div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:py-24">
				<div>
					<p className="font-mono text-sm font-semibold text-secondary-700">{PACKAGE_NAME}</p>
					<h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
						Paint backgrounds with code, use them like plain CSS
					</h1>
					<p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-920">
						Ready-made CSS Paint API worklets: rain, ripples, grids, low-poly meshes and organic gradients.
						Import once, then write <code className="rounded bg-neutral-50 px-1.5 py-0.5 font-mono text-[0.85em]">background-image: --tp-rain()</code> and
						tune everything with custom properties.
					</p>

					<div className="mt-8 flex max-w-md items-center gap-2 rounded-lg border border-neutral-100 bg-white/90 py-1 pr-1 pl-3 backdrop-blur">
						<span aria-hidden="true" className="font-mono text-xs font-semibold text-tertiary-800 select-none">$</span>
						<code className="min-w-0 flex-1 truncate font-mono text-xs">{INSTALL_COMMAND}</code>
						<CopyButton text={INSTALL_COMMAND} />
					</div>

					<div className="mt-6 flex flex-wrap gap-3">
						{firstPaintlet && (
							<a
								href={paintletPath(firstPaintlet.id)}
								className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
							>
								<Icon name="palette" size={18} />
								Open the playground
							</a>
						)}
						<ExternalLink
							href={SOURCE_URL}
							className="inline-flex items-center gap-2 rounded-lg border border-neutral-100 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-990 transition-colors hover:border-neutral-250"
						>
							<Icon brand="github" size={16} />
							Source
						</ExternalLink>
					</div>
				</div>

				<div
					aria-hidden="true"
					className="aspect-square w-full rounded-3xl bg-linear-to-br from-primary-500 via-secondary-500 to-tertiary-500 shadow-2xl shadow-secondary-500/20 ring-1 ring-black/5"
					style={heroVisualStyle}
				/>
			</div>
		</section>
	);
}
