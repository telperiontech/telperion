import { CodeBlock } from '@osw/docs';
import { INSTALL_COMMAND, model } from '../model';

const OPTIONS: { title: string; text: string; code: string; language: string }[] = [
	{
		title: 'With a bundler',
		text: 'Install once, then import only the entry points you use. Each import defines its elements.',
		code: `${INSTALL_COMMAND}\n\n# in your code\nimport "${model.packageName}/button";\nimport "${model.packageName}/select";`,
		language: 'sh',
	},
	{
		title: 'From a CDN',
		text: 'One script tag defines every element; no build step needed.',
		code: `<script src="${model.cdnUrl}"></script>`,
		language: 'html',
	},
	{
		title: 'Then write HTML',
		text: 'Attributes configure the elements; events and properties work like on native ones.',
		code: `<tp-button color="success" shade="600">Save</tp-button>\n\n<tp-icon>favorite</tp-icon>`,
		language: 'html',
	},
];

export function Install() {
	return (
		<section aria-labelledby="install-title" className="border-y border-neutral-100 bg-neutral-20">
			<div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
				<h2 id="install-title" className="text-2xl font-semibold tracking-tight">Get started</h2>
				<ol className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
					{OPTIONS.map((option, index) => (
						<li key={option.title} className="flex flex-col rounded-xl border border-neutral-100 bg-white p-4">
							<p className="font-mono text-xs font-semibold text-secondary-700">0{index + 1}</p>
							<h3 className="mt-1 text-sm font-semibold">{option.title}</h3>
							<p className="mt-1 mb-3 text-sm text-neutral-920">{option.text}</p>
							<CodeBlock code={option.code} language={option.language} className="mt-auto" />
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
