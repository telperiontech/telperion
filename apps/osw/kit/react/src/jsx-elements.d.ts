import type { CSSProperties, ReactNode } from 'react';

interface BaseAttributes {
	class?: string;
	style?: CSSProperties;
	'aria-hidden'?: 'true' | 'false';
	'aria-label'?: string;
	children?: ReactNode;
}

/** `<tp-icon>` from `@telperion/elements/icon` */
interface TpIconAttributes extends BaseAttributes {
	family?: 'material' | 'simple-icons' | 'thesvg';
	slug?: string;
	variant?: string;
	filled?: '' | undefined;
}

/** `<tp-portal>` from `@telperion/elements/portal` (registered by the shell) */
interface TpPortalAttributes extends BaseAttributes {
	name: string;
}

/** `<osw-copy-button>` from `@osw/core` */
interface OswCopyButtonAttributes extends BaseAttributes {
	text: string;
}

declare module 'react' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			'tp-icon': TpIconAttributes;
			'tp-portal': TpPortalAttributes;
			'osw-copy-button': OswCopyButtonAttributes;
			'osw-tree-mark': BaseAttributes;
		}
	}
}
