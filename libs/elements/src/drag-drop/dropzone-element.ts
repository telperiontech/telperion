import { CSSResultGroup, LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { DragElementEventTypes, DropElementEventTypes, DragDropEvent } from "./drag-drop-event";

declare global {
  interface HTMLElementTagNameMap {
    /**
     * A drop target for `<tp-drag>` elements. It reports drags over it with
     * events and reflected attributes; it does not move anything by itself.
     *
     * To accept a drop, call `event.acceptDrop(rect?)` in a `tp-dropzone-drop` listener:
     * the dragged element then animates into `rect` (or back to its origin
     * without one). Move the element in the DOM in the `tp-dropzone-drop-end` listener,
     * which fires once that animation is over.
     *
     * @example
     * ```html
     * <tp-dropzone name="done" accept="task, bug">Done</tp-dropzone>
     *
     * <script>
     *   const zone = document.querySelector('tp-dropzone');
     *
     *   zone.addEventListener('tp-dropzone-drop', event => event.acceptDrop(zone.getBoundingClientRect()));
     *   zone.addEventListener('tp-dropzone-drop-end', event => zone.append(event.dragTarget.deref()));
     * </script>
     * ```
     *
     * @attr {string} name - Identifies the zone; reflected on the dragged element as `draggedover`.
     * @attr {string} accept - Comma-separated `<tp-drag>` names this zone reacts to. Empty or missing: every name.
     * @attr {boolean} acceptabledrag - Read-only. Set while a drag this zone accepts is in progress anywhere on the page.
     * @attr {string} itemdragged - Read-only. The `name` of the accepted element currently over the zone.
     *
     * @fires tp-dropzone-enter - An accepted element entered the zone.
     * @fires tp-dropzone-leave - An accepted element left the zone.
     * @fires tp-dropzone-over - An accepted element moves over the zone (fires continuously).
     * @fires tp-dropzone-drop - An accepted element was released over the zone. Call `event.acceptDrop(rect?)` here.
     * @fires tp-dropzone-drop-end - The drop accepted by this zone finished animating. Move the element in the DOM here.
     */
    "tp-dropzone": DropZoneElement;
  }
}

let LAST_DRAG_EVENT: DragDropEvent;

document.addEventListener('tp-drag-start', event => {
  LAST_DRAG_EVENT = event;
});

@customElement('tp-dropzone')
export class DropZoneElement extends LitElement {
  static override styles?: CSSResultGroup = css``;

  #enterCount = 0;

  /** `<tp-drag>` names this zone reacts to (`accept="task, bug"`). Empty: every name. */
  @property({ converter: value => (value ?? '').split(',').map(str => str.trim()) })
  accept: string[] = [];

  /** Identifies the zone; reflected on the dragged element as `draggedover`. */
  @property({ type: String })
  name = '';

  /** The `name` of the accepted element currently over the zone, or `null`. */
  @property({ type: String, reflect: true, attribute: "itemdragged" })
  itemDragged: string | null = null;

  /** Whether a drag this zone accepts is in progress anywhere on the page. */
  @property({ type: Boolean, reflect: true, attribute: "acceptabledrag" })
  acceptableDrag = false;

  protected override render(): TemplateResult {
    return html`<slot></slot>`;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    document.addEventListener('tp-drag-start', this.#handleGlobalDragStart);
    document.addEventListener('tp-drag-end', this.#handleGlobalDragEnd);
    document.addEventListener('tp-dropzone-drop-end', this.#handleGlobalDragEnd);
    this.addEventListener('dragenter', this.#handleDragEnter);
    this.addEventListener('dragleave', this.#handleDragLeave);
    this.addEventListener('dragover', this.#handleDragOver);
    this.addEventListener('drop', this.#handleDrop);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    document.removeEventListener('tp-drag-start', this.#handleGlobalDragStart);
    document.removeEventListener('tp-drag-end', this.#handleGlobalDragEnd);
    document.removeEventListener('tp-dropzone-drop-end', this.#handleGlobalDragEnd);
    this.removeEventListener('dragenter', this.#handleDragEnter);
    this.removeEventListener('dragleave', this.#handleDragLeave);
    this.removeEventListener('dragover', this.#handleDragOver);
    this.removeEventListener('drop', this.#handleDrop);
  }

  #handleGlobalDragStart = (event: DragDropEvent) => {
    if (!this.accept.length || this.accept.includes(event.name!)) {
      this.acceptableDrag = true;
    }
  };

  #handleGlobalDragEnd = () => {
    this.itemDragged = null;
    this.acceptableDrag = false;
    this.#enterCount = 0;
  };

  #handleDragEnter = (event: DragEvent) => {
    if (!this.#isAcceptableDrag()) return;

    if (++this.#enterCount > 1) return;

    this.itemDragged = LAST_DRAG_EVENT.name ?? '';
    this.#dispatchEventWithCounter('tp-dropzone-enter', 'tp-drag-zone-enter', event);
  };

  #handleDragLeave = (event: DragEvent) => {
    if (!this.#isAcceptableDrag()) return;

    if (--this.#enterCount > 0) return;

    this.itemDragged = null;
    this.#dispatchEventWithCounter('tp-dropzone-leave', 'tp-drag-zone-leave', event);
  };

  #handleDragOver = (event: DragEvent) => {
    if (!this.#isAcceptableDrag()) return;

    this.#dispatchEventWithCounter('tp-dropzone-over', 'tp-drag-zone-over', event);
  };

  #handleDrop = (event: DragEvent) => {
    if (!this.#isAcceptableDrag()) return;

    this.#dispatchEventWithCounter('tp-dropzone-drop', 'tp-drag-drop', event);
  };

  #isAcceptableDrag(): boolean {
    return !LAST_DRAG_EVENT.name || !this.accept.length || this.accept.includes(LAST_DRAG_EVENT.name!);
  }

  #dispatchEventWithCounter(eventName: DropElementEventTypes, counterEventName: DragElementEventTypes, event: DragEvent) {
    const { dragTarget } = LAST_DRAG_EVENT;
    const dropzoneTarget = new WeakRef(this);

    this.dispatchEvent(new DragDropEvent(eventName, { dragTarget, dropzoneTarget }, event));
    dragTarget.deref()?.dispatchEvent(new DragDropEvent(counterEventName, { dragTarget, dropzoneTarget }, event));
  }
}
