import { Code } from '@osw/react';
import { useApiDocs } from '../config';
import type { DocsCategory } from '../model';
import { EntryList } from './EntryList';

export function CategoryPage({ category }: { category: DocsCategory }) {
	const { model, name, overviewPath, entriesOf, categoryBarrels } = useApiDocs();
	const entries = entriesOf(category);
	// Root-level modules form a category too, but have no folder (and no barrel) of their own
	const hasBarrel = categoryBarrels && entries.some((entry) => entry.id.startsWith(`${category.id}/`));

	return (
		<section className="max-w-4xl">
			<nav aria-label="Breadcrumb" className="text-xs text-neutral-850">
				<a href={overviewPath()} className="hover:text-neutral-990">{name}</a>
			</nav>
			<h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{category.title}</h1>
			{category.description && <p className="mt-3 text-base text-neutral-920">{category.description}</p>}
			{hasBarrel && (
				<p className="mt-2 text-sm text-neutral-850">
					Import all at once from <Code code={`${model.packageName}/${category.id}`} />, or each from its own path for the smallest bundle.
				</p>
			)}
			<div className="mt-8">
				<EntryList entries={entries} />
			</div>
		</section>
	);
}
