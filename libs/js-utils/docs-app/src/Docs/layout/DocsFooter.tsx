import { ExternalLink } from '@osw/react';
import { model } from '../model';
import { REPO_URL } from '../routing';

export function DocsFooter() {
	const generated = new Date(model.generatedAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });

	return (
		<footer className="border-t border-neutral-100">
			<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-neutral-850 sm:px-6">
				<p>
					Generated from the source of <code className="font-mono">{model.packageName}@{model.version}</code> on {generated}.
				</p>
				<p className="flex gap-4">
					<ExternalLink href={`${REPO_URL}/issues`} className="hover:text-neutral-990">Report an issue</ExternalLink>
					<span>© {new Date().getFullYear()} Telperion · MIT</span>
				</p>
			</div>
		</footer>
	);
}
