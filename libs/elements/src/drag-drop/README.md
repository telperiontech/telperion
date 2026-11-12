# Drag & Drop: `<tp-drag>` / `<tp-drag-handle>` / `<tp-dropzone>`

Declarative drag and drop on top of the native HTML Drag and Drop API. The element you drag **is** the drag image: it follows the pointer, can be styled with plain CSS while it moves, and animates into place (or back home) when released.

```html
<tp-drag name="task" data-drag-id="42" replaceclone>Write the docs</tp-drag>

<tp-dropzone name="done" accept="task">Done</tp-dropzone>

<script type="module">
  import '@telperion/elements/drag-drop';

  const zone = document.querySelector('tp-dropzone');

  // 1. Accept the drop and tell the element where to land
  zone.addEventListener('tp-dropzone-drop', (event) => event.acceptDrop(zone.getBoundingClientRect()));

  // 2. Once it has landed, move it in the DOM
  zone.addEventListener('tp-dropzone-drop-end', (event) => zone.append(event.dragTarget.deref()));
</script>
```

## Highlights

- **The real element moves**: no translucent browser ghost. Style `tp-drag[dragging]` to lift, tilt or scale it (scaling grows around the grab point).
- **Animated release**: back to where it came from, or into the rectangle a drop zone passes to `acceptDrop(rect)`.
- **Filtering**: drop zones react only to the `name`s listed in `accept`.
- **Handles**: `<tp-drag-handle>` restricts where an element can be grabbed.
- **Data**: `data-drag-*` attributes travel with the drag as `event.dragData`.
- **Placeholders**: `replaceclone` keeps the element's place in the layout while it is away.
- **Everything is reflected**: `[dragging]`, `[draggedover]`, `[acceptabledrag]`, `[itemdragged]`… so state styling needs no JavaScript.
- Nested drag elements work: the innermost one under the pointer is dragged.

## Installation

```ts
import '@telperion/elements/drag-drop';
```

```html
<script src="https://unpkg.com/@telperion/elements/iife/drag-drop/index.js"></script>
```

## How a drag works

1. **Grab**: the user starts dragging a `<tp-drag>` (or one of its handles). It gets `[dragging]`, switches to `position: fixed` and follows the pointer. With `replaceclone`, a `<tp-drag-clone>` placeholder is inserted in its place. `tp-drag-start` fires.
2. **Hover**: every `<tp-dropzone>` whose `accept` matches gets `[acceptabledrag]`. The one under the pointer gets `[itemdragged]` and fires `tp-dropzone-enter` / `tp-dropzone-over` / `tp-dropzone-leave`; the dragged element mirrors them (`tp-drag-zone-enter`, …) and reflects the zone's name in `[draggedover]`.
3. **Drop**: releasing over a matching zone fires `tp-dropzone-drop` on it. **Nothing is accepted by default**: call `event.acceptDrop(rect)` in that listener to accept.
4. **Release animation**: the element gets `[dragend]` and transitions to `rect` if the drop was accepted, or back to where it started.
5. **Done**: after the animation the placeholder is removed and the state attributes are cleared. If the drop was accepted, `tp-dropzone-drop-end` fires on the zone: **this is where you move the element in the DOM**. Finally `tp-drag-end` fires on the element.

### Landing exactly in place

`acceptDrop(rect)` takes a viewport rectangle (as returned by `getBoundingClientRect()`). For the element to land exactly where it will live, reserve that spot first and measure it:

```js
const slots = new WeakMap();

zone.addEventListener('tp-dropzone-drop', (event) => {
  const item = event.dragTarget.deref();
  const slot = document.createElement('div');

  slot.style.height = `${item.preDragData.boundingRect.height}px`;
  zone.querySelector('.list').append(slot);
  slots.set(item, slot);

  event.acceptDrop(slot.getBoundingClientRect());
});

zone.addEventListener('tp-dropzone-drop-end', (event) => {
  const item = event.dragTarget.deref();

  slots.get(item)?.replaceWith(item);
});
```

The *Board* story in Storybook is a complete kanban built this way.

## Elements

### `<tp-drag>`

Makes its content draggable.

| Attribute          | Type                   | Default | Description                                                                                  |
| ------------------ | ---------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `name`             | `string`               |         | Matched against drop zones' `accept`.                                                        |
| `draggingstrategy` | `move` \| `copyMove`   | `move`  | Sets `dataTransfer.effectAllowed`. Both animate the same way; the element itself always moves. |
| `replaceclone`     | `boolean`              | `false` | Leave a `<tp-drag-clone>` placeholder in place while dragging.                              |
| `disabled`         | `boolean`              | `false` | Prevents dragging.                                                                           |
| `data-drag-*`      | `string`               |         | Data carried by the drag; read as `element.dragData` / `event.dragData`.                     |

Read-only state attributes:

| Attribute      | Set while…                                                                     |
| -------------- | ------------------------------------------------------------------------------ |
| `dragging`     | the element is dragged, including the release animation.                       |
| `draggedover`  | it is over an accepting drop zone. The value is the zone's `name`.             |
| `dropaccepted` | a drop zone called `acceptDrop()`, until the release animation ends.           |
| `dragend`      | the release animation runs.                                                    |

Properties: `dragData` (the `data-drag-*` values without the prefix, kept in sync), `clone` (the current placeholder, if any), `preDragData` (`boundingRect` and `dragStartEvent` captured when the drag started).

### `<tp-drag-handle>`

Put one or more inside a `<tp-drag>` and the element can only be grabbed by them; the rest of its content stays selectable and clickable. A handle belongs to its nearest `<tp-drag>` ancestor.

```html
<tp-drag>
  <tp-drag-handle>⠿</tp-drag-handle>
  Only the dots start a drag.
</tp-drag>
```

### `<tp-dropzone>`

A drop target. It reports drags but never moves anything itself.

| Attribute        | Type     | Description                                                                         |
| ---------------- | -------- | ----------------------------------------------------------------------------------- |
| `name`           | `string` | The zone's name; mirrored on the dragged element as `draggedover`.                  |
| `accept`         | `string` | Comma-separated `<tp-drag>` names (`accept="task, bug"`). Missing or empty: all.   |
| `acceptabledrag` | read-only | Set while a drag this zone accepts is in progress anywhere on the page.            |
| `itemdragged`    | read-only | Set while an accepted element is over the zone. The value is the element's `name`. |

## Event reference

All events are `DragDropEvent`s (a `DragEvent` subclass) and bubble, so a single listener on a container sees all of them.

| Event              | Dispatched on | When                                                                     |
| ------------------ | ------------- | ------------------------------------------------------------------------ |
| `tp-drag-start`     | `<tp-drag>`     | Dragging started.                                                     |
| `tp-dropzone-enter`     | `<tp-dropzone>` | An accepted element entered the zone.                                 |
| `tp-drag-zone-enter` | `<tp-drag>`     | The element entered an accepting zone.                                |
| `tp-dropzone-over`      | `<tp-dropzone>` | An accepted element moves over the zone (continuously).               |
| `tp-drag-zone-over`  | `<tp-drag>`     | The element moves over an accepting zone (continuously).              |
| `tp-dropzone-leave`     | `<tp-dropzone>` | An accepted element left the zone.                                    |
| `tp-drag-zone-leave` | `<tp-drag>`     | The element left an accepting zone.                                   |
| `tp-dropzone-drop`          | `<tp-dropzone>` | An accepted element was released over the zone. Call `acceptDrop()`.  |
| `tp-drag-drop`       | `<tp-drag>`     | The element was released over an accepting zone.                      |
| `tp-dropzone-drop-end`       | `<tp-dropzone>` | The accepted drop finished animating. Move the element here.          |
| `tp-drag-end`       | `<tp-drag>`     | The drag is completely over (after `tp-dropzone-drop-end`).                     |

`DragDropEvent` members:

| Member              | Description                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `dragTarget`        | `WeakRef` to the dragged `<tp-drag>`.                                                                        |
| `dropzoneTarget`    | `WeakRef` to the `<tp-dropzone>`, for zone-related events.                                                   |
| `dragData`          | The dragged element's `data-drag-*` values.                                                                   |
| `name`              | The `name` of the element the event is dispatched on. In a zone listener use `dragTarget.deref()?.name` for the item's name. |
| `acceptDrop(rect)`  | Accepts the drop and animates the element into `rect` (viewport coordinates).                                  |

## Styling

The elements render no visuals of their own; style them like any other element.

```css
/* Custom elements are inline by default */
tp-drag,
tp-drag-clone {
  display: block;
  box-sizing: border-box; /* the dragged size is measured with getBoundingClientRect() */
}

tp-drag { cursor: grab; }
tp-drag[dragging] { cursor: grabbing; box-shadow: 0 12px 28px rgb(0 0 0 / .2); }
tp-drag[dragging]:not([dragend]) { scale: 1.05; rotate: 2deg; }

/* The placeholder left by replaceclone copies the element's attributes and children */
tp-drag-clone { border: 2px dashed #d4d4d8; color: transparent; }
tp-drag-clone * { visibility: hidden; }

tp-dropzone[acceptabledrag] { outline: 2px dashed #a1a1aa; }
tp-dropzone[itemdragged] { background: #eff6ff; }

/* Slower, springy release */
tp-drag {
  transition-duration: .5s;
  transition-timing-function: cubic-bezier(.34, 1.56, .64, 1);
}
```

### CSS custom properties

| Property         | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `--tp-drag-offset-x` | Horizontal offset of the dragged element from the pointer (`0px`). Inherited. |
| `--tp-drag-offset-y` | Vertical offset of the dragged element from the pointer (`0px`). Inherited.   |

While dragging, the element also exposes read-only geometry you can use in your own rules: `--tp-drag-width`, `--tp-drag-height`, `--tp-drag-left`, `--tp-drag-top` (start rectangle), `--tp-drag-x`, `--tp-drag-y` (grab point), `--tp-drag-cx`, `--tp-drag-cy` (current pointer) and, once a drop is accepted, `--tp-drag-target-width|height|left|top|right|bottom`.

## Gotchas

- **Always pass a rectangle to `acceptDrop()`.** Without one the release animation has nothing to animate to, so it never ends: the element stays `[dragging]` with `pointer-events: none`, and neither `tp-dropzone-drop-end` nor `tp-drag-end` fires. To accept and send the element back home, pass `event.dragTarget.deref().preDragData.boundingRect`.
- **Don't use the `transition` shorthand on `<tp-drag>`.** The release animation relies on `transition-property`; a shorthand like `transition: background .2s` replaces it, the release doesn't animate, and the drag never finishes (same symptoms as above). Set `transition-duration` / `transition-timing-function` only.
- **Don't set `position` on `<tp-drag>`.** The element switches to `position: fixed` while dragged; your own `position` rule would override that.
- **Move elements on `tp-dropzone-drop-end`, not `tp-dropzone-drop`.** At `tp-dropzone-drop` the element is still being dragged and is about to animate.
- **The placeholder is a copy.** `<tp-drag-clone>` copies the element's attributes (including `id` and `class`) and children. Prefer classes over ids for styling, and don't rely on listeners inside it.
- **Unnamed elements are not filtered.** A `<tp-drag>` without `name` fires events on every drop zone, even ones with `accept`, but those zones don't get `[acceptabledrag]`. Give draggable elements a `name` when you use `accept`.
- `draggroup` is reserved and has no effect yet.
