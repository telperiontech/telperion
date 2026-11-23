import { CodeLine, Markdown } from '@osw/docs';
import { getPage, IMAGE_REF, model } from '../model';
import { pagePath } from '../routing';

function PageCard({ slug }: { slug: string }) {
	const page = getPage(slug);

	if (!page) return null;

	return (
		<a href={pagePath(slug)} className="block rounded-xl border border-neutral-40 p-4 transition-colors hover:border-secondary-240">
			<span className="text-sm font-semibold text-neutral-900">{page.title}</span>
			<span className="mt-1 line-clamp-2 block text-sm text-neutral-660">{page.summary}</span>
		</a>
	);
}

/** The README's introduction, the pull command, and a card per page of each sidebar group */
export function OverviewPage() {
	return (
		<div className="max-w-4xl">
			<header>
				<p className="font-mono text-sm font-semibold text-secondary-600">{IMAGE_REF}</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">frp-gate</h1>
				<CodeLine code={`docker pull ${IMAGE_REF}:${model.version}`} language="sh" prompt="$" className="mt-6 max-w-xl bg-neutral-10" />
			</header>

			<div className="mt-6">
				<Markdown source={model.intro} size="base" />
			</div>

			{model.nav.map((group) => (
				<section key={group.title} aria-labelledby={`group-${group.title}`} className="mt-12">
					<h2 id={`group-${group.title}`} className="text-lg font-semibold tracking-tight">{group.title}</h2>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						{group.slugs.map((slug) => <PageCard key={slug} slug={slug} />)}
					</div>
				</section>
			))}
		</div>
	);
}
