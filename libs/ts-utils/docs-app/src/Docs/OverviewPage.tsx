import { CodeBlock, CodeLine } from '@osw/docs';
import { EntryList, useApiDocs } from '@osw/api';

const usage = (packageName: string) => `import { FifoPromise } from "${packageName}/fifo-promise";

class Api {
  @FifoPromise({ delay: 100 })
  async save(data: Data) {
    // Calls run one at a time, in the order they were made
  }
}`;

export function OverviewPage() {
	const { model, docsPath, entriesOf } = useApiDocs();

	return (
		<div className="max-w-4xl">
			<header>
				<p className="font-mono text-sm font-semibold text-secondary-600">{model.packageName}</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Type-safe TypeScript helpers</h1>
				<p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-660">
					Decorators and helpers that lean on TypeScript's type system and class syntax. Built on top of{' '}
					<a href="/js-utils" className="font-medium text-secondary-660 hover:underline">js-utils</a>.
					This reference is generated from the library's source on every release.
				</p>
				<CodeLine code={`pnpm add ${model.packageName}`} language="sh" prompt="$" className="mt-6 max-w-md bg-neutral-10" />
			</header>

			<section aria-labelledby="usage" className="mt-12">
				<h2 id="usage" className="text-lg font-semibold tracking-tight">Per-module imports</h2>
				<p className="mt-1 text-sm text-neutral-660">Every helper lives at its own path, so bundles only include what you use.</p>
				<CodeBlock code={usage(model.packageName)} copyable={false} className="mt-4" />
			</section>

			{model.categories.map((category) => (
				<section key={category.id} aria-labelledby={`category-${category.id}`} className="mt-12">
					<h2 id={`category-${category.id}`} className="text-lg font-semibold tracking-tight">
						<a href={docsPath(category.id)} className="hover:text-secondary-660">{category.title}</a>
					</h2>
					{category.description && <p className="mt-1 text-sm text-neutral-660">{category.description}</p>}
					<div className="mt-4">
						<EntryList entries={entriesOf(category)} />
					</div>
				</section>
			))}
		</div>
	);
}
