import { CodeLine } from '@osw/docs';
import { EntryList, useApiDocs } from '@osw/api';
import { MarblePlayground, scenarios } from '../marbles';

const featured = scenarios['operators/debounce-time-buffer']?.[0];

export function OverviewPage() {
	const { model, docsPath, entriesOf } = useApiDocs();

	return (
		<div className="max-w-4xl">
			<header>
				<p className="font-mono text-sm font-semibold text-secondary-700">{model.packageName}</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">RxJS operators and adapters</h1>
				<p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-920">
					Operators for buffering, multicasting and picking values, plus bridges between Observables, callbacks and
					async iterables. Every operator page has a live marble diagram: the real code runs on virtual time,
					and you can drag the inputs to see how it reacts.
				</p>
				<CodeLine code={`pnpm add ${model.packageName} rxjs`} language="sh" prompt="$" className="mt-6 max-w-md bg-neutral-30" />
			</header>

			{featured && (
				<section aria-labelledby="featured" className="mt-12">
					<h2 id="featured" className="text-lg font-semibold tracking-tight">
						<a href={docsPath('operators/debounce-time-buffer')} className="hover:text-secondary-800">debounceTimeBuffer</a>, live
					</h2>
					<p className="mt-1 text-sm text-neutral-920">
						Press play, then drag a marble into a gap or change <span className="font-mono">dueTime</span> to watch the bursts regroup.
					</p>
					<MarblePlayground scenario={featured} />
				</section>
			)}

			{model.categories.map((category) => (
				<section key={category.id} aria-labelledby={`category-${category.id}`} className="mt-12">
					<h2 id={`category-${category.id}`} className="text-lg font-semibold tracking-tight">
						<a href={docsPath(category.id)} className="hover:text-secondary-800">{category.title}</a>
					</h2>
					{category.description && <p className="mt-1 text-sm text-neutral-920">{category.description}</p>}
					<div className="mt-4">
						<EntryList entries={entriesOf(category)} />
					</div>
				</section>
			))}
		</div>
	);
}
