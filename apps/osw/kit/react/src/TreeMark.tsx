interface TreeMarkProps {
	/** Keep static: `<osw-tree-mark>` adds its own host classes on connect */
	className?: string;
}

/** React wrapper over `<osw-tree-mark>` from `@osw/core` */
export function TreeMark({ className }: TreeMarkProps) {
	return <osw-tree-mark class={className} />;
}
