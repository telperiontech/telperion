import type { ComponentType } from 'react';
import { Markdown } from '@osw/docs';
import type { Page, PageKind } from '../../model/types';
import { groupOf } from '../model';
import { ApiReference, CliReference, ConfigFileReference, EnvReference, ExampleList } from '../reference';
import { homePath } from '../routing';
import { PrevNext } from './PrevNext';

/** What a page shows below its prose; guides are prose only */
const REFERENCES: Partial<Record<PageKind, ComponentType>> = {
	env: EnvReference,
	api: ApiReference,
	cli: CliReference,
	'config-file': ConfigFileReference,
	examples: ExampleList,
};

/** A guide (a README section), a reference generated from Go, or the examples */
export function DocPage({ page }: { page: Page }) {
	const Reference = REFERENCES[page.kind];

	return (
		<article className="max-w-3xl">
			<nav aria-label="Breadcrumb" className="text-xs text-neutral-550">
				<a href={homePath()} className="hover:text-neutral-900">frp-gate</a>
				<span aria-hidden="true" className="mx-1.5 text-neutral-130">/</span>
				{groupOf(page.slug)}
			</nav>
			<h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{page.title}</h1>
			<Markdown source={page.markdown} headingTag="h2" anchors size="base" />
			{Reference && <Reference />}
			<PrevNext slug={page.slug} />
		</article>
	);
}
