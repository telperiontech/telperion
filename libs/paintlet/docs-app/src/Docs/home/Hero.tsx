import { CodeLine, primaryButtonClass, secondaryButtonClass } from '@osw/docs';
import { Code, ExternalLink, Icon } from '@osw/react';
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
						Import once, then write <Code code="background-image: --tp-rain()" /> and
						tune everything with custom properties.
					</p>

					<CodeLine code={INSTALL_COMMAND} language="sh" prompt="$" className="mt-8 max-w-md bg-white/90 backdrop-blur" />

					<div className="mt-6 flex flex-wrap gap-3">
						{firstPaintlet && (
							<a href={paintletPath(firstPaintlet.id)} className={primaryButtonClass}>
								<Icon name="palette" size={18} />
								Open the playground
							</a>
						)}
						<ExternalLink href={SOURCE_URL} className={secondaryButtonClass}>
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
