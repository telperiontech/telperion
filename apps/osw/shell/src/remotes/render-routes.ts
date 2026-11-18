import { REMOTES } from './registry';

/**
 * Adds a `<tp-route>` per remote to the shell's `<tp-router>`, ahead of its catch-all route.
 * Runs before `<tp-router>` is defined, so the first navigation already sees every route.
 */
export function renderRemoteRoutes(): void {
	const router = document.querySelector('tp-router');

	if (!router) throw new Error('index.html has no <tp-router>');

	const catchAll = router.querySelector(':scope > tp-route[path="*"]');

	for (const remote of REMOTES) {
		const route = document.createElement('tp-route');
		const template = document.createElement('template');
		const element = document.createElement(remote.tagName);

		route.setAttribute('path', remote.route);
		element.className = 'block flex-1';
		template.content.append(element);
		route.append(template);
		router.insertBefore(route, catchAll);
	}
}
