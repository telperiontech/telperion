import { insertNode, moveNode, nodesBetween, removeNode, replaceNode } from "./dom-ops";

/**
 * The part of an outlet a single portal owns: a `<!--tp-portal-->` …
 * `<!--/tp-portal-->` comment pair, with the portal's nodes in between.
 *
 * Markers keep each portal's nodes contiguous even when several portals share
 * an outlet, and give frameworks a stable `nextSibling` to insert before
 * (Angular / Vue insert relative to siblings, which land inside the range).
 */
export class Projection {
  readonly #start = document.createComment("tp-portal");
  readonly #end = document.createComment("/tp-portal");
  #container: Node | null = null;

  /** The node currently hosting the projected content, if any. */
  get container(): Node | null {
    return this.#container;
  }

  get active(): boolean {
    return this.#container !== null;
  }

  /** Nodes currently projected (in order). */
  nodes(): Node[] {
    return this.#container ? nodesBetween(this.#start, this.#end) : [];
  }

  /** Whether `ref` is a valid insertion reference inside the projected range. */
  owns(ref: Node | null): boolean {
    return ref === null || (this.#container !== null && ref.parentNode === this.#container);
  }

  /** Opens the range at the end of `container` and moves `source`'s children into it. */
  open(container: Node, source: Node): void {
    this.#container = container;
    insertNode(container, this.#start, null);
    insertNode(container, this.#end, null);
    this.pull(source);
  }

  /** Moves every child of `source` into the range (keeps order). */
  pull(source: Node): void {
    if (!this.#container) return;
    for (const node of Array.from(source.childNodes)) moveNode(this.#container, node, this.#end);
  }

  /** Moves projected nodes back to `target`, removes the markers and closes the range. */
  close(target: Node): void {
    if (!this.#container) return;
    const nodes = this.nodes();
    this.#container = null;
    for (const node of nodes) moveNode(target, node, null);
    removeNode(this.#start);
    removeNode(this.#end);
  }

  // -- Forwarded mutations (only valid while active) -------------------------

  insert(node: Node, ref: Node | null): void {
    insertNode(this.#container!, node, ref ?? this.#end);
  }

  prepend(node: Node): void {
    insertNode(this.#container!, node, this.#start.nextSibling);
  }

  remove(node: Node): void {
    removeNode(node);
  }

  replace(next: Node, prev: Node): void {
    replaceNode(this.#container!, next, prev);
  }

  clear(): void {
    for (const node of this.nodes()) removeNode(node);
  }

  /** Reference node to use for `moveBefore` forwarding. */
  refFor(ref: Node | null): Node {
    return ref ?? this.#end;
  }
}
