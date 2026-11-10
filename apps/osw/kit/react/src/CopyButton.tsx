interface CopyButtonProps {
	text: string;
	/** Keep static: `<osw-copy-button>` adds its own host classes on connect */
	className?: string;
}

/** React wrapper over `<osw-copy-button>` from `@osw/core` */
export function CopyButton({ text, className }: CopyButtonProps) {
	return <osw-copy-button text={text} class={className} />;
}
