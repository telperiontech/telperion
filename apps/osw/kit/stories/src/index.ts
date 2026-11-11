/**
 * Storybook-style playgrounds for the osw docs remotes: the framework-agnostic core
 * (also available alone as `@osw/stories/core`) plus React controls, canvas and sidebar.
 *
 * Remotes must add `@source "<path>/apps/osw/kit/stories/src"` to their Tailwind entry
 * so the classes used here are generated.
 */
export * from './core';
export { StoryCanvas, ZoomBadge, useFitZoom, type FitOptions } from './canvas';
export { ControlsPanel } from './controls';
export { StoryHeader, StorySidebar, useStoryArgs } from './playground';
