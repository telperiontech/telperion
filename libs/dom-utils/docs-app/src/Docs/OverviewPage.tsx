import { CodeBlock, CodeLine } from '@osw/docs';
import { EntryList, useApiDocs } from '@osw/api';

const usage = (packageName: string) => `import { getParents } from "${packageName}/get-parents";
import { DomClone } from "${packageName}/dom-clone";

// Walk up lazily and stop at the first match
for (const parent of getParents(button)) {
  if (parent.matches("dialog")) break;
}

// Keep a live copy of an element anywhere in the page
const mirror = new DomClone(card);
preview.append(mirror.clone);`;

export function OverviewPage() {
	const { model, docsPath, entriesOf } = useApiDocs();

	return (
		<div className="max-w-4xl">
			<header>
				<p className="font-mono text-sm font-semibold text-secondary-600">{model.packageName}</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Small helpers for the DOM</h1>
				<p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-660">
					Tree-shakable, dependency-free and fully typed helpers for walking and mirroring DOM elements.
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
