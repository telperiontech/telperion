/**
 * The `<template>` children of a `<tp-route>`, grouped by role.
 */
export interface RouteTemplates {
  /** The route's own content: the first template without a role attribute. */
  content: DocumentFragment | null;
  /** Shown while the route's `src` is loading (`<template data-loading>`). */
  loading: DocumentFragment | null;
  /** Shown when the route's `src` failed to load (`<template data-error>`). */
  error: DocumentFragment | null;
}

/**
 * Collects the direct `<template>` children of a route element by role.
 * For each role the first matching template wins.
 */
export function readRouteTemplates(route: Element): RouteTemplates {
  const templates = Array.from(route.children).filter(
    (child): child is HTMLTemplateElement => child instanceof HTMLTemplateElement,
  );
  const find = (predicate: (template: HTMLTemplateElement) => boolean) =>
    templates.find(predicate)?.content ?? null;

  return {
    content: find(template => !template.hasAttribute("data-loading") && !template.hasAttribute("data-error")),
    loading: find(template => template.hasAttribute("data-loading")),
    error: find(template => template.hasAttribute("data-error")),
  };
}
