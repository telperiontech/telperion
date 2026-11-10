import { ExternalLink, Icon } from '@osw/react';
import { DeclarationDetails, ExtensionSection, extensionKinds, ImportLine, KindBadge, namedImport } from '../entry';
import { getCategory, type DocsEntry } from '../model';
import { docsPath, overviewPath, sourceUrl } from '../routing';

const sectionTitle = 'mt-12 text-lg font-semibold tracking-tight';

export function EntryPage({ entry }: { entry: DocsEntry }) {
	const { primary } = entry;
	const category = getCategory(entry.category);

	return (
		<article className="max-w-3xl">
			<nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-850">
				<a href={overviewPath()} className="hover:text-neutral-990">js-utils</a>
				<span aria-hidden="true">/</span>
				{category && <a href={docsPath(category.id)} className="hover:text-neutral-990">{category.title}</a>}
			</nav>

			<header className="mt-3">
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{primary.name}</h1>
					<KindBadge kind={primary.kind} />
					{extensionKinds(entry).map((kind) => <KindBadge key={kind} kind={kind} />)}
				</div>
				{primary.summary && <p className="mt-3 text-base leading-relaxed text-neutral-920">{primary.summary}</p>}
				<div className="mt-5 flex flex-wrap items-center gap-3">
					<div className="min-w-0 flex-1">
						<ImportLine statement={namedImport([primary.name], entry.importPath)} />
					</div>
					<ExternalLink
						href={sourceUrl(entry.sourcePath)}
						className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-920 hover:text-secondary-800"
					>
						<Icon brand="github" size={14} />
						Source
					</ExternalLink>
				</div>
			</header>

			<DeclarationDetails declaration={primary} summaryShown />

			{entry.extensions.length > 0 && (
				<section aria-labelledby="extensions">
					<h2 id="extensions" className={sectionTitle}>Prototype &amp; static versions</h2>
					<p className="mt-1 text-sm text-neutral-920">
						Opt-in modules that install <code className="font-mono">{primary.name}</code> on a built-in. Import them once, for their side effect.
					</p>
					<div className="mt-4 space-y-4">
						{entry.extensions.map((extension) => <ExtensionSection key={extension.importPath} extension={extension} />)}
					</div>
				</section>
			)}

			{entry.related.length > 0 && (
				<section aria-labelledby="related">
					<h2 id="related" className={sectionTitle}>Also exported</h2>
					{entry.related.map((declaration) => (
						<div key={declaration.name} id={declaration.name} className="mt-8 scroll-mt-20">
							<div className="flex items-center gap-2">
								<h3 className="font-mono text-base font-semibold">{declaration.name}</h3>
								<KindBadge kind={declaration.kind} />
							</div>
							<DeclarationDetails declaration={declaration} />
						</div>
					))}
				</section>
			)}
		</article>
	);
}
