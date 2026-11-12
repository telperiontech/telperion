/**
 * @telperion/elements
 * A collection of custom web components built with Lit Elements
 */

// Router components
export * from './router';

// Drag & drop components
export * from './drag-drop';

// Details-set components
export * from './details-set';

// Popover components
export * from './popover';

// Select components
export * from './select';

// Button components
export * from './button';

// Portal components
export * from './portal';

// Date components
export * from './date';

// `<tp-code>` is intentionally NOT re-exported here: its bundled loader pulls in
// every Shiki grammar via `import()`, which the self-contained root IIFE would
// inline (~8 MB). Import it from `@telperion/elements/code` (bundlers) or load
// `iife/code/cdn.js` (script tag, grammars from the CDN).

