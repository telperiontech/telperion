/**
 * Native DOM operations captured before `<tp-portal>` overrides them, so the
 * element can still reach its *own* light DOM while forwarding framework
 * mutations to its outlet.
 */

type MoveBefore = (this: Node, node: Node, child: Node | null) => void;

const nativeInsertBefore = Node.prototype.insertBefore;
const nativeRemoveChild = Node.prototype.removeChild;
const nativeReplaceChild = Node.prototype.replaceChild;
const nativeMoveBefore = (Element.prototype as unknown as { moveBefore?: MoveBefore }).moveBefore;

export function insertNode(parent: Node, node: Node, ref: Node | null): void {
  nativeInsertBefore.call(parent, node, ref);
}

export function removeNode(node: Node): void {
  if (node.parentNode) nativeRemoveChild.call(node.parentNode, node);
}

export function replaceNode(parent: Node, next: Node, prev: Node): void {
  nativeReplaceChild.call(parent, next, prev);
}

/**
 * Moves `node` into `parent` before `ref`. Prefers the state-preserving
 * `moveBefore()` (focus, iframes, animations, no disconnect/connect
 * reactions) and falls back to a plain insertion where it is unsupported or
 * not allowed (e.g. one side is disconnected).
 */
export function moveNode(parent: Node, node: Node, ref: Node | null, preferMove = true): void {
  if (preferMove && nativeMoveBefore && node.isConnected && parent.isConnected) {
    try {
      nativeMoveBefore.call(parent, node, ref);
      return;
    } catch {
      /* fall back to insertBefore */
    }
  }
  nativeInsertBefore.call(parent, node, ref);
}

export function hasNativeMoveBefore(): boolean {
  return nativeMoveBefore !== undefined;
}

export function nativeMove(parent: Node, node: Node, ref: Node | null): void {
  if (!nativeMoveBefore) throw new DOMException("moveBefore is not supported", "NotSupportedError");
  nativeMoveBefore.call(parent, node, ref);
}

/** Nodes strictly between two sibling markers (empty when the markers were torn out). */
export function nodesBetween(start: Node, end: Node): Node[] {
  const nodes: Node[] = [];
  if (!start.parentNode || start.parentNode !== end.parentNode) return nodes;
  for (let n = start.nextSibling; n && n !== end; n = n.nextSibling) nodes.push(n);
  return nodes;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", " ": "&nbsp;" };

/** Minimal HTML serialization of a node list (used for `innerHTML` while projected). */
export function serializeNodes(nodes: Node[]): string {
  return nodes
    .map((n) => {
      if (n instanceof Element) return n.outerHTML;
      if (n.nodeType === Node.TEXT_NODE) return (n.nodeValue ?? "").replace(/[&<> ]/g, (c) => ESCAPES[c] ?? c);
      if (n.nodeType === Node.COMMENT_NODE) return `<!--${n.nodeValue ?? ""}-->`;
      return "";
    })
    .join("");
}
