import { CodeBlock, CodeLine } from '@osw/docs';
import { Code } from '@osw/react';
import { EntryList, useApiDocs } from '@osw/api';

const usage = (packageName: string) => `import type { PartialSome, Tail } from "${packageName}";

interface User {
  id: number;
  name: string;
}

type NewUser = PartialSome<User, "id">;        // id becomes optional
type Rest = Tail<[ctx: Context, id: number]>;  // [id: number]`;
const polyfillUsage = (packageName: string) => `// Once, e.g. in your entry file or a global .d.ts
import "${packageName}/polyfills";

const pattern = new URLPattern({ pathname: "/books/:id" });`;

export function OverviewPage() {
	const { model, docsPath, entriesOf } = useApiDocs();

	return (
		<div className="max-w-4xl">
			<header>
				<p className="font-mono text-sm font-semibold text-secondary-600">{model.packageName}</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Extra utility types</h1>
				<p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-660">
					Type-level helpers that fill gaps in TypeScript's built-in utility types, plus declarations for web APIs
					the DOM library does not ship yet. Types only: nothing ends up in your bundle.
					This reference is generated from the library's source on every release.
				</p>
				<CodeLine code={`pnpm add ${model.packageName}`} language="sh" prompt="$" className="mt-6 max-w-md bg-neutral-10" />
			</header>

			<section aria-labelledby="usage" className="mt-12">
				<h2 id="usage" className="text-lg font-semibold tracking-tight">Type-only imports</h2>
				<p className="mt-1 text-sm text-neutral-660">
					Import from the package root or from each type's own path, with <Code code="import type" language="ts" /> so
					the import is always erased from the output.
				</p>
				<CodeBlock code={usage(model.packageName)} copyable={false} className="mt-4" />
			</section>

			<section aria-labelledby="polyfills-usage" className="mt-12">
				<h2 id="polyfills-usage" className="text-lg font-semibold tracking-tight">Global declarations</h2>
				<p className="mt-1 text-sm text-neutral-660">
					Polyfills declare globals, so import them once for their side effect. They add types only: in runtimes
					without the API, load a runtime polyfill as well.
				</p>
				<CodeBlock code={polyfillUsage(model.packageName)} copyable={false} className="mt-4" />
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
