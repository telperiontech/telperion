import { FeatureGrid, type Feature } from '@osw/docs';

const FEATURES: Feature[] = [
	{
		icon: 'html',
		title: 'Framework-agnostic',
		text: 'Standard custom elements built with Lit. Use them from plain HTML, React, Angular, Vue or a CMS template.',
	},
	{
		icon: 'assignment_turned_in',
		title: 'Real form controls',
		text: '<tp-button> and <tp-select> are form-associated: they submit, reset, validate and restore like native controls.',
	},
	{
		icon: 'format_paint',
		title: 'Styled by your CSS',
		text: 'Elements render into the light DOM, so global styles, Tailwind utilities and design tokens apply directly.',
	},
	{
		icon: 'palette',
		title: 'One palette',
		text: 'Pick a color token and a shade from 0 to 1000; hover, focus and contrast colors are derived in CSS.',
	},
];

export function Features() {
	return <FeatureGrid title="Why these elements" features={FEATURES} />;
}
