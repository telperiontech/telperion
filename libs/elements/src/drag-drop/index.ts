import type { DragDropEvent } from './drag-drop-event';

declare global {
  interface GlobalEventHandlersEventMap {
    'tp-drag-move': DragDropEvent;
    'tp-drag-start': DragDropEvent;
    'tp-drag-end': DragDropEvent;
    'tp-dropzone-drop': DragDropEvent;
    'tp-dropzone-drop-end': DragDropEvent;
    'tp-drag-drop': DragDropEvent;
    'tp-dropzone-enter': DragDropEvent;
    'tp-dropzone-leave': DragDropEvent;
    'tp-dropzone-over': DragDropEvent;
    'tp-drag-zone-enter': DragDropEvent;
    'tp-drag-zone-leave': DragDropEvent;
    'tp-drag-zone-over': DragDropEvent;
  }
}

export { DragElement } from './drag-element';
export { DropZoneElement } from './dropzone-element';
export { DragHandleElement } from './drag-handle-element';
export { DragDropEvent } from './drag-drop-event';
export type { DragElementEventTypes, DropElementEventTypes, DragDropEventTypes } from './drag-drop-event';
