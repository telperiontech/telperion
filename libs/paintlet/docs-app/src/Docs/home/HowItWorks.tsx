import { CodeBlock, type Language } from '@osw/docs';
import { INSTALL_COMMAND, PACKAGE_NAME } from '../meta';

const STEPS: { title: string; text: string; code: string; language: Language }[] = [
	{
		title: 'Install',
		text: 'One dependency, no runtime framework.',
		code: INSTALL_COMMAND,
		language: 'shell',
	},
	{
		title: 'Register',
		text: 'Importing the package registers every worklet, its typed properties and its CSS helpers.',
		code: `import '${PACKAGE_NAME}';`,
		language: 'ts',
	},
	{
		title: 'Paint',
		text: 'Use the paintlet like any CSS image and tune it with custom properties.',
		code: `.hero {\n  background-image: --tp-rain();\n  animation: --tp-rain-animation(1s);\n  --tp-rain-color: #4a90e2;\n  --tp-rain-density: 80;\n}`,
		language: 'css',
	},
	{
		title: 'Shadow DOM (optional)',
		text: 'CSS functions and keyframes are tree-scoped; adopt the shared sheet into each shadow root.',
		code: `import { getPaintletStyleSheet } from '${PACKAGE_NAME}';\n\nconst sheet = getPaintletStyleSheet();\nif (sheet) shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];`,
		language: 'ts',
	},
];

export function HowItWorks() {
	return (
		<section aria-labelledby="how-title" className="border-y border-neutral-100 bg-neutral-20">
			<div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
				<h2 id="how-title" className="text-2xl font-semibold tracking-tight">How to use it</h2>
				<ol className="mt-8 space-y-4">
					{STEPS.map((step, index) => (
						<li key={step.title} className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-100 bg-white p-4 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-6">
							<div>
								<p className="font-mono text-xs font-semibold text-secondary-700">0{index + 1}</p>
								<h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
								<p className="mt-1 text-sm text-neutral-920">{step.text}</p>
							</div>
							<CodeBlock code={step.code} language={step.language} />
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
