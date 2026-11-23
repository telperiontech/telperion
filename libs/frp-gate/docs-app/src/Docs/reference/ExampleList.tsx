import { CodeBlock, sourceUrl } from '@osw/docs';
import { ExternalLink } from '@osw/react';
import { exampleId } from '../../model/ids';
import { model } from '../model';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Every file of `examples/`, as it is in the repository */
export function ExampleList() {
	return (
		<>
			{model.examples.map((example) => {
				const id = exampleId(example.path);

				return (
					<section key={example.path} aria-labelledby={id} className="mt-10">
						<h2 id={id} className="flex scroll-mt-20 flex-wrap items-baseline justify-between gap-2">
							<span className="font-mono text-base font-semibold">{example.path}</span>
							<ExternalLink href={sourceUrl(`libs/frp-gate/examples/${example.path}`)} className="text-xs font-medium text-secondary-660 hover:underline">
								View on GitHub
							</ExternalLink>
						</h2>
						{example.description && <p className="mt-1 text-sm text-neutral-660">{capitalize(example.description)}.</p>}
						<CodeBlock code={example.code} language={example.language} className="mt-3" />
					</section>
				);
			})}
		</>
	);
}
