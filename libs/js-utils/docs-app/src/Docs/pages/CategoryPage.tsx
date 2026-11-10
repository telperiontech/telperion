import { entriesOf, model, type DocsCategory } from '../model';
import { overviewPath } from '../routing';
import { EntryList } from './EntryList';

export function CategoryPage({ category }: { category: DocsCategory }) {
	return (
		<section className="max-w-4xl">
			<nav aria-label="Breadcrumb" className="text-xs text-neutral-850">
				<a href={overviewPath()} className="hover:text-neutral-990">js-utils</a>
			</nav>
			<h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{category.title}</h1>
			{category.description && <p className="mt-3 text-base text-neutral-920">{category.description}</p>}
			{category.id !== 'core' && (
				<p className="mt-2 text-sm text-neutral-850">
					Import all at once from <code className="font-mono text-neutral-990">{model.packageName}/{category.id}</code>, or each from its own path for the smallest bundle.
				</p>
			)}
			<div className="mt-8">
				<EntryList entries={entriesOf(category)} />
			</div>
		</section>
	);
}
