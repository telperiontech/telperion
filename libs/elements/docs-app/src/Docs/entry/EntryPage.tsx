import { ExternalLink, Icon } from '@osw/react';
import { CodeLine, Inline, Markdown, sideEffectImport, treeUrl } from '@osw/docs';
import { eventsOf, type EntryDoc } from '../model';
import { PreviewFrame } from '../preview-frame';
import { storyPath } from '../routing';
import { storiesOf } from '../stories';
import { ElementReference } from './ElementReference';

const chipClass =
	'inline-flex items-center gap-1 rounded-full border border-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-920 transition-colors hover:border-secondary-300 hover:text-secondary-800';

/** Docs of one entry point: live preview, guide (README) and API reference */
export function EntryPage({ entry }: { entry: EntryDoc }) {
	const stories = storiesOf(entry);
	const first = stories[0];

	return (
		<>
			<header>
				<p className="font-mono text-sm font-semibold text-secondary-700">{entry.importPath}</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{entry.title}</h1>
				<p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-920">
					<Inline text={entry.summary} />
				</p>
				<div className="mt-4 max-w-xl">
					<CodeLine code={sideEffectImport(entry.importPath)} language="ts" />
				</div>
				<p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-850">
					<span>Defines {entry.elements.map((element) => `<${element.tagName}>`).join(', ')}</span>
					<ExternalLink href={treeUrl(entry.sourcePath)} className="font-medium hover:text-secondary-800">Source</ExternalLink>
				</p>
			</header>

			{first && (
				<section aria-labelledby="preview-title" className="mt-8">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 id="preview-title" className="text-lg font-semibold tracking-tight">Try it</h2>
						<a href={storyPath(entry.id, first.story.id)} className="inline-flex items-center gap-1 text-sm font-medium text-secondary-800 hover:underline">
							Open the playground
							<Icon name="arrow_forward" size={16} />
						</a>
					</div>
					<PreviewFrame
						title={`${entry.title} preview`}
						componentId={first.component.id}
						storyId={first.story.id}
						args={{}}
						events={[]}
						maxHeight={420}
						className="mt-3 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-20"
					/>
					<ul className="mt-3 flex flex-wrap gap-2" aria-label="Stories">
						{stories.map(({ story }) => (
							<li key={story.id}>
								<a href={storyPath(entry.id, story.id)} className={chipClass}>{story.name}</a>
							</li>
						))}
					</ul>
				</section>
			)}

			{entry.guide && (
				<section aria-labelledby="guide-title" className="mt-12 max-w-3xl">
					<h2 id="guide-title" className="text-lg font-semibold tracking-tight">Guide</h2>
					<Markdown source={entry.guide} skipIntro />
				</section>
			)}

			<section aria-labelledby="api-title" className="mt-12">
				<h2 id="api-title" className="text-lg font-semibold tracking-tight">API reference</h2>
				<p className="mt-1 text-sm text-neutral-850">
					Generated from the Custom Elements Manifest. The playground logs these events: {eventsOf(entry).map((name) => `\`${name}\``).join(', ')}.
				</p>
				<div className="mt-4 space-y-6">
					{entry.elements.map((element) => (
						<ElementReference key={element.tagName} element={element} />
					))}
				</div>
			</section>
		</>
	);
}
