import { Icon } from '@osw/react';

const FEATURES = [
	{
		icon: 'brush',
		title: 'A canvas behind any element',
		text: 'The CSS Paint API (CSS Houdini) lets a worklet draw an element\'s background like a canvas, yet the result is a regular CSS image.',
	},
	{
		icon: 'aspect_ratio',
		title: 'Always the right size',
		text: 'The browser repaints on resize and at the device pixel ratio, so there is no image to export, scale or keep in sync.',
	},
	{
		icon: 'animation',
		title: 'Animatable with CSS',
		text: 'Inputs are typed, registered custom properties: transition them, drive them with @keyframes, or use the built-in --tp-*-animation() helpers.',
	},
	{
		icon: 'layers',
		title: 'Works in shadow DOM',
		text: 'Adopt getPaintletStyleSheet() into a shadow root and the same helpers work inside web components.',
	},
];

export function Features() {
	return (
		<section aria-labelledby="features-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
			<h2 id="features-title" className="text-2xl font-semibold tracking-tight">What a paintlet is</h2>
			<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{FEATURES.map((feature) => (
					<div key={feature.title}>
						<span className="grid size-10 place-items-center rounded-lg bg-secondary-100 text-secondary-800">
							<Icon name={feature.icon} size={22} />
						</span>
						<h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
						<p className="mt-1.5 text-sm leading-relaxed text-neutral-920">{feature.text}</p>
					</div>
				))}
			</div>
		</section>
	);
}
