/**
 * Anchor id of a markdown heading, as GitHub derives it (`## Using your own Caddy` →
 * `using-your-own-caddy`), so links written for a README also work in the docs.
 * React-free: docs-model generators import it.
 */
export function headingId(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.trim()
		.replace(/\s/g, '-');
}
