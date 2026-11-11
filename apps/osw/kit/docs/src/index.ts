/**
 * Building blocks shared by the osw docs remotes (React): the remote bootstrap, markdown,
 * highlighted code, the docs page frame, home page sections, tool panels and links.
 * Each remote still owns its routes and pages.
 *
 * Remotes must add `@source "<path>/apps/osw/kit/docs/src"` to their Tailwind entry
 * so the classes used here are generated.
 */
export * from './code';
export * from './home';
export * from './layout';
export * from './markdown';
export * from './meta';
export * from './pages';
export * from './remote';
export * from './routing';
export * from './ui';
