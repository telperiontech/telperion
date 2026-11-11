/** Fills every `[data-current-year]` element of the static page chrome with the current year */
export function fillCurrentYear(root: ParentNode = document): void {
	const year = String(new Date().getFullYear());

	root.querySelectorAll('[data-current-year]').forEach((element) => (element.textContent = year));
}
