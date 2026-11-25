/**
 * Lazily yields each ancestor of `node`, from its parent up to the root element.
 *
 * Nothing is walked until the generator is iterated, so breaking out early (e.g. once a
 * matching ancestor is found) stops the walk there.
 *
 * @param node The element to start from; it is not yielded itself.
 * @returns A generator of the ancestors, closest first. Stops when there is no further `parentElement`.
 *
 * @example
 * ```ts
 * import { getParents } from '@telperion/dom-utils/get-parents';
 *
 * const child = document.querySelector('.deep-child')!;
 *
 * for (const parent of getParents(child)) {
 *   console.log(parent.tagName);
 * }
 *
 * // First scrollable ancestor
 * const scroller = [...getParents(child)].find((el) => el.scrollHeight > el.clientHeight);
 * ```
 */
export function* getParents<T extends HTMLElement = HTMLElement>(node: T): Generator<T> {
  while (node.parentElement) {
    yield node = node.parentElement as T;
  }
}
