import { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface CopyButtonProps {
	text: string;
	className?: string;
}

export function CopyButton({ text, className = '' }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 1500);
		return () => clearTimeout(timer);
	}, [copied]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
		} catch {
			// Clipboard can be unavailable (insecure context, denied permission); fail quietly.
		}
	};

	return (
		<button
			type="button"
			onClick={copy}
			aria-label={copied ? 'Copied' : `Copy "${text}"`}
			title={copied ? 'Copied' : 'Copy'}
			className={`grid place-items-center size-7 rounded-md text-neutral-850 hover:text-neutral-990 hover:bg-neutral-50 transition-colors ${className}`}
		>
			{/* Two static icons toggled by visibility so <tp-icon> text never changes under React */}
			<span className={copied ? 'hidden' : 'contents'}>
				<Icon name="content_copy" size={16} />
			</span>
			<span className={copied ? 'contents text-success-600' : 'hidden'}>
				<Icon name="check" size={16} />
			</span>
		</button>
	);
}
