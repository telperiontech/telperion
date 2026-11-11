/** The non-empty path segments below `basePath`, or `undefined` when the path is outside it */
export function pathSegments(pathname: string, basePath: string): string[] | undefined {
	if (!pathname.startsWith(basePath)) return undefined;

	return pathname.slice(basePath.length).split('/').filter(Boolean);
}
