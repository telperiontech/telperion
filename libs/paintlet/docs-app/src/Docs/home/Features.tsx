import { FeatureGrid, type Feature } from '@osw/docs';

const FEATURES: Feature[] = [
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
	return <FeatureGrid title="What a paintlet is" features={FEATURES} />;
}
