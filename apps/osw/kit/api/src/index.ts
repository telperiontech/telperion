/**
 * API reference for TypeScript libraries (React): the docs model types, the pages for
 * modules, categories and declarations, and `<ApiDocsRoot>`, which routes them.
 * The generator that builds the model lives in `../generator` (Node).
 *
 * A remote calls `createApiDocs({ model, name, basePath, libRoot, overview })` once,
 * renders `<ApiDocsRoot docs={…} />`, and writes only its overview page.
 *
 * Remotes must add `@source "<path>/apps/osw/kit/api/src"` to their Tailwind entry
 * so the classes used here are generated.
 */
export { ApiDocsRoot } from './ApiDocsRoot';
export * from './config';
export * from './entry';
export * from './layout';
export * from './model';
export * from './pages';
export * from './routing';
