interface DiagramProps {
	/** Mermaid source */
	code: string;
	/** Accessible name; when set, the diagram is exposed as one image */
	label?: string;
	className?: string;
}

/**
 * Thin React wrapper over `<tp-mermaid>` from `@telperion/elements/mermaid`, which the shell
 * registers. The source goes in as a text child (no HTML parsing involved), like `Code`.
 */
export function Diagram({ code, label, className }: DiagramProps) {
	return (
		<tp-mermaid label={label} class={className}>
			{code}
		</tp-mermaid>
	);
}
