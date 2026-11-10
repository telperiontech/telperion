import { CopyButton } from '@osw/react';
import { CodeBlock } from '../markdown';
import { model } from '../model';
import { docsPath } from '../routing';

const INSTALL = `pnpm add ${model.packageName}`;

const USAGES = [
	{
		title: 'Per-function imports',
		text: 'Every helper lives at its own path, so bundles only include what you use.',
		code: `import { difference } from "${model.packageName}/array/difference";\n\ndifference([1, 2, 3], [2]); // [1, 3]`,
	},
	{
		title: 'Prototype extensions',
		text: 'Opt in to methods on built-ins by importing their proto module once.',
		code: `import "${model.packageName}/array/proto/difference";\n\n[1, 2, 3].difference([2]); // [1, 3]`,
	},
	{
		title: 'Static extensions',
		text: 'Or install helpers as static methods on global constructors.',
		code: `import "${model.packageName}/promise/static/timeout";\n\nawait Promise.timeout(1000);`,
	},
];

export function OverviewPage() {
	return (
		<div className="max-w-4xl">
			<header>
				<p className="font-mono text-sm font-semibold text-secondary-700">{model.packageName}</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">JavaScript utilities, one import at a time</h1>
				<p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-920">
					Zero-dependency helpers for arrays, objects, promises, functions and more, with full TypeScript types.
					This reference is generated from the library's source on every release.
				</p>
				<div className="mt-6 flex max-w-md items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-30 py-1 pr-1 pl-3">
					<span aria-hidden="true" className="font-mono text-xs font-semibold text-tertiary-800 select-none">$</span>
					<code className="min-w-0 flex-1 truncate font-mono text-xs">{INSTALL}</code>
					<CopyButton text={INSTALL} />
				</div>
			</header>

			<section aria-labelledby="usage" className="mt-12">
				<h2 id="usage" className="text-lg font-semibold tracking-tight">Three ways to use it</h2>
				<div className="mt-4 space-y-4">
					{USAGES.map((usage) => (
						<div key={usage.title} className="grid gap-3 rounded-xl border border-neutral-100 p-4 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-5">
							<div>
								<h3 className="text-sm font-semibold">{usage.title}</h3>
								<p className="mt-1 text-sm text-neutral-920">{usage.text}</p>
							</div>
							<CodeBlock code={usage.code} copyable={false} />
						</div>
					))}
				</div>
			</section>

			<section aria-labelledby="modules" className="mt-12">
				<h2 id="modules" className="text-lg font-semibold tracking-tight">Modules</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					{model.categories.map((category) => (
						<a
							key={category.id}
							href={docsPath(category.id)}
							className="group rounded-xl border border-neutral-100 p-5 transition-[border-color,box-shadow] hover:border-secondary-300 hover:shadow-lg hover:shadow-secondary-500/10"
						>
							<div className="flex items-baseline justify-between gap-2">
								<h3 className="font-semibold group-hover:text-secondary-800">{category.title}</h3>
								<span className="text-xs text-neutral-850">{category.entryIds.length}</span>
							</div>
							<p className="mt-1 text-sm text-neutral-920">{category.description}</p>
							<p className="mt-3 truncate font-mono text-xs text-neutral-850">
								{category.entryIds.map((id) => id.split('/').pop()).join(' · ')}
							</p>
						</a>
					))}
				</div>
			</section>
		</div>
	);
}
