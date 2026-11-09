import type { CSSProperties, ReactNode } from 'react';

interface TpIconAttributes {
	class?: string;
	style?: CSSProperties;
	family?: 'material' | 'simple-icons' | 'thesvg';
	slug?: string;
	variant?: string;
	filled?: '' | undefined;
	'aria-hidden'?: 'true' | 'false';
	'aria-label'?: string;
	children?: ReactNode;
}

declare module 'react' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			'tp-icon': TpIconAttributes;
		}
	}
}
