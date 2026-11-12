import type { DragElement } from "./drag-element";
import type { DropZoneElement } from "./dropzone-element";
import { ACCEPT_DROP_PROP } from "./private-props";

/** Events dispatched on the `<tp-drag>` element */
export type DragElementEventTypes = 'tp-drag-move' | 'tp-drag-start' | 'tp-drag-end' | 'tp-drag-zone-enter' | 'tp-drag-zone-leave' | 'tp-drag-zone-over' | 'tp-drag-drop';
/** Events dispatched on the `<tp-dropzone>` element */
export type DropElementEventTypes = 'tp-dropzone-drop' | 'tp-dropzone-drop-end' | 'tp-dropzone-enter' | 'tp-dropzone-leave' | 'tp-dropzone-over';
export type DragDropEventTypes = DragElementEventTypes | DropElementEventTypes;

interface DragDropEventDict {
  dragTarget: WeakRef<DragElement>;
  dropzoneTarget?: WeakRef<DropZoneElement>;
}

/**
 * The event type of every `tp-drag-*` / `tp-dropzone-*` event. It extends `DragEvent`
 * (pointer coordinates, modifier keys, … come from the native event it wraps)
 * and bubbles like the native drag events do.
 */
export class DragDropEvent extends DragEvent {
  static #DragElementEvents: DragElementEventTypes[] = ['tp-drag-move', 'tp-drag-start', 'tp-drag-end', 'tp-drag-zone-enter', 'tp-drag-zone-leave', 'tp-drag-zone-over', 'tp-drag-drop'];
  static #DropElementEvents: DropElementEventTypes[] = ['tp-dropzone-drop', 'tp-dropzone-drop-end', 'tp-dropzone-enter', 'tp-dropzone-leave', 'tp-dropzone-over'];

  /** The `<tp-drag>` being dragged. */
  declare readonly dragTarget: WeakRef<DragElement>;
  /** The `<tp-dropzone>` involved; `undefined` for `tp-drag-start` / `tp-drag-end`. */
  declare readonly dropzoneTarget?: WeakRef<DropZoneElement>;

  get #target() {
    if (DragDropEvent.#DropElementEvents.includes(this.type as DropElementEventTypes)) {
      return this.dropzoneTarget!;
    } else if (DragDropEvent.#DragElementEvents.includes(this.type as DragElementEventTypes)) {
      return this.dragTarget;
    }

    return new WeakRef(this.target as (DragElement | DropZoneElement));
  }

  /**
   * The `name` of the element the event is dispatched on: the drop zone's name for
   * drop zone events, the dragged element's name for drag element events.
   * Use `dragTarget.deref()?.name` for the dragged element's name in drop zone listeners.
   */
  get name(): string | undefined {
    return this.#target.deref()?.name;
  }

  /** The dragged element's `data-drag-*` values (see `DragElement.dragData`). */
  get dragData() {
    return this.dragTarget.deref()?.dragData;
  }

  constructor(
    type: DragDropEventTypes,
    { dragTarget, dropzoneTarget }: DragDropEventDict,
    eventInitDict?: DragEventInit
  ) {
    super(type, eventInitDict);

    this.dragTarget = dragTarget;
    this.dropzoneTarget = dropzoneTarget;
  }

  /**
   * Accepts the drop on `dropzoneTarget`. Call it in a `tp-dropzone-drop` listener.
   * The dragged element then animates into `rect` (viewport coordinates, e.g. from
   * `getBoundingClientRect()`), or back to where it started without one, and
   * `tp-dropzone-drop-end` fires on the drop zone when the animation is over.
   */
  acceptDrop(rect?: DOMRect) {
    this.dragTarget.deref()?.[ACCEPT_DROP_PROP](this.dropzoneTarget!, rect);
  }
}
