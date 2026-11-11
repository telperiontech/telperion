import { ExternalLink, Icon } from '@osw/react';
import { CodeBlock, InstallCommand, primaryButtonClass, secondaryButtonClass } from '@osw/docs';
import { INSTALL_COMMAND, model } from '../model';
import { entryPath, SOURCE_URL, storyPath } from '../routing';
import { storiesOf } from '../stories';

const HERO_SNIPPET = `<form>
  <tp-select name="size" placeholder="Pick a size">
    <tp-option value="s">Small</tp-option>
    <tp-option value="m">Medium</tp-option>
  </tp-select>

  <tp-button type="submit" color="primary">
    Save
  </tp-button>
</form>`;

export function Hero() {
	const firstEntry = model.entries[0];
	const firstStory = firstEntry && storiesOf(firstEntry)[0];

	return (
		<section className="relative overflow-hidden border-b border-neutral-100 bg-linear-to-b from-secondary-20 to-white">
			<div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_30rem] lg:py-24">
				<div>
					<p className="font-mono text-sm font-semibold text-secondary-700">{model.packageName}</p>
					<h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
						Web components that behave like native elements
					</h1>
					<p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-920">
						Buttons and selects that join your forms, popovers placed by CSS, accordions, icons, drag and drop and a declarative router.
						Plain HTML tags, so they work with any framework or none.
					</p>

					<InstallCommand command={INSTALL_COMMAND} className="mt-8 bg-white/90 backdrop-blur" />

					<div className="mt-6 flex flex-wrap gap-3">
						{firstEntry && (
							<a href={entryPath(firstEntry.id)} className={primaryButtonClass}>
								<Icon name="menu_book" size={18} />
								Read the docs
							</a>
						)}
						{firstStory && (
							<a href={storyPath(firstEntry.id, firstStory.story.id)} className={secondaryButtonClass}>
								<Icon name="tune" size={18} />
								Open the playground
							</a>
						)}
						<ExternalLink href={SOURCE_URL} className={secondaryButtonClass}>
							<Icon brand="github" size={16} />
							Source
						</ExternalLink>
					</div>
				</div>

				<div className="rounded-2xl bg-white p-2 shadow-2xl shadow-secondary-500/15 ring-1 ring-black/5">
					<CodeBlock code={HERO_SNIPPET} language="html" copyable={false} className="border-0" />
				</div>
			</div>
		</section>
	);
}
