import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import "./drag-element";
import "./dropzone-element";

import type { DragElement } from "./drag-element";
import type { DragDropEvent } from "./drag-drop-event";

const styles = html`
  <style>
    .zone-demo {
      display: grid;
      gap: 16px;
      max-width: 760px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
    }

    .zone-demo .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-height: 42px;
    }

    .zone-demo .zones {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .zone-demo tp-dropzone {
      display: grid;
      align-content: start;
      gap: 8px;
      min-height: 140px;
      padding: 12px;
      border: 2px dashed #d4d4d8;
      border-radius: 12px;
      background: #fafafa;
      transition: border-color 0.15s, background-color 0.15s, opacity 0.15s;
    }

    .zone-demo tp-dropzone > strong {
      color: #3f3f46;
      font-size: 13px;
    }

    .zone-demo tp-dropzone > small {
      color: #71717a;
    }

    .zone-demo :is(tp-drag, tp-drag-clone) {
      display: block;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1px solid #d4d4d8;
      border-radius: 8px;
      background: white;
    }

    .zone-demo tp-drag {
      cursor: grab;
      user-select: none;
    }

    .zone-demo tp-drag[dragging] {
      cursor: grabbing;
      box-shadow: 0 12px 28px rgb(0 0 0 / 0.2);
    }

    .zone-demo tp-drag-clone {
      border: 2px dashed #d4d4d8;
      background: transparent;
      color: transparent;
    }
  </style>
`;
/** Landing slots, created on `tp-dropzone-drop` and replaced by the element on `tp-dropzone-drop-end` */
const landingSlots = new WeakMap<DragElement, HTMLElement>();
/** Accepts the drop into the zone's `.row` list, landing at its end */
const acceptIntoRow = (event: DragDropEvent): void => {
  const zone = event.dropzoneTarget?.deref();
  const item = event.dragTarget.deref();

  if (!zone || !item) return;

  const { width, height } = item.preDragData.boundingRect;
  const slot = document.createElement("div");

  slot.style.width = `${width}px`;
  slot.style.height = `${height}px`;
  zone.querySelector(".row")!.append(slot);
  landingSlots.set(item, slot);

  event.acceptDrop(slot.getBoundingClientRect());
};
const moveIntoRow = (event: DragDropEvent): void => {
  const item = event.dragTarget.deref();
  const slot = item && landingSlots.get(item);

  if (!item || !slot) return;

  slot.replaceWith(item);
  landingSlots.delete(item);
};
const meta: Meta = {
  title: "Elements/Drag & Drop/Drop Zone",
  component: "tp-dropzone",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    controls: { disable: true },
    docs: {
      description: {
        component:
          "`<tp-dropzone>` reports drags over it with events and reflected attributes. It never moves anything itself: accept a drop with `event.acceptDrop(rect)` on `tp-dropzone-drop`, then move the element on `tp-dropzone-drop-end`.",
      },
    },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "Filtering with accept",
  parameters: {
    docs: {
      description: {
        story:
          "Each item has a `name`; each zone lists the names it takes in `accept` (none means all). While dragging, zones that accept the item get `[acceptabledrag]` and the one under the pointer gets `[itemdragged]`. Zones that don't accept the item fire no events, so the drop is refused and it flies back.",
      },
    },
  },
  render: () => html`
    ${styles}
    <style>
      .zone-demo.filtering:has(tp-drag[dragging]) tp-dropzone:not([acceptabledrag]) {
        opacity: 0.4;
      }

      .zone-demo.filtering tp-dropzone[acceptabledrag] {
        border-color: #86efac;
      }

      .zone-demo.filtering tp-dropzone[itemdragged] {
        border-color: #16a34a;
        background: #f0fdf4;
      }

      .zone-demo.filtering tp-dropzone.shelf {
        min-height: 0;
      }
    </style>
    <div class="zone-demo filtering">
      <tp-dropzone class="shelf" name="shelf" @tp-dropzone-drop=${acceptIntoRow} @tp-dropzone-drop-end=${moveIntoRow}>
        <small>Shelf (no accept: takes everything)</small>
        <div class="row">
          <tp-drag name="fruit" replaceclone>🍎 Apple</tp-drag>
          <tp-drag name="fruit" replaceclone>🍌 Banana</tp-drag>
          <tp-drag name="vegetable" replaceclone>🥕 Carrot</tp-drag>
          <tp-drag name="vegetable" replaceclone>🥦 Broccoli</tp-drag>
        </div>
      </tp-dropzone>
      <div class="zones">
        <tp-dropzone name="basket" accept="fruit" @tp-dropzone-drop=${acceptIntoRow} @tp-dropzone-drop-end=${moveIntoRow}>
          <strong>Fruit basket</strong>
          <small>accept="fruit"</small>
          <div class="row"></div>
        </tp-dropzone>
        <tp-dropzone name="crate" accept="vegetable" @tp-dropzone-drop=${acceptIntoRow} @tp-dropzone-drop-end=${moveIntoRow}>
          <strong>Veggie crate</strong>
          <small>accept="vegetable"</small>
          <div class="row"></div>
        </tp-dropzone>
        <tp-dropzone name="any" accept="fruit, vegetable" @tp-dropzone-drop=${acceptIntoRow} @tp-dropzone-drop-end=${moveIntoRow}>
          <strong>Market stall</strong>
          <small>accept="fruit, vegetable"</small>
          <div class="row"></div>
        </tp-dropzone>
      </div>
    </div>
  `,
};

export const ReflectedAttributes: Story = {
  name: "Reflected attributes",
  parameters: {
    docs: {
      description: {
        story:
          "Drag state is reflected as attributes, so styling it needs no JavaScript. This story prints them with `attr()`: the zones show `acceptabledrag` / `itemdragged`, the badge under the dragged item shows `dragging`, `draggedover`, `dragend` and `dropaccepted`. Only **left** accepts the drop.",
      },
    },
  },
  render: () => html`
    ${styles}
    <style>
      .zone-demo.reflect tp-dropzone::after,
      .zone-demo.reflect tp-drag[dragging]::after {
        font-family: ui-monospace, monospace;
        font-size: 12px;
        white-space: pre;
      }

      /* Shown first, so the dragged item doesn't cover it */
      .zone-demo.reflect tp-dropzone::after {
        order: -1;
        content: "(no attributes)";
        color: #a1a1aa;
      }

      .zone-demo.reflect tp-dropzone[acceptabledrag]::after {
        content: "acceptabledrag";
        color: #2563eb;
      }

      .zone-demo.reflect tp-dropzone[acceptabledrag][itemdragged]::after {
        content: "acceptabledrag  itemdragged=\\"" attr(itemdragged) "\\"";
      }

      .zone-demo.reflect tp-dropzone[itemdragged] {
        border-color: #2563eb;
        background: #eff6ff;
      }

      /* The dragged element is position: fixed, so the badge can be positioned against it */
      .zone-demo.reflect tp-drag[dragging]::after {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        padding: 2px 6px;
        border-radius: 4px;
        background: #18181b;
        color: white;
        content: "dragging";
      }

      .zone-demo.reflect tp-drag[dragging][draggedover]::after {
        content: "dragging  draggedover=\\"" attr(draggedover) "\\"";
      }

      .zone-demo.reflect tp-drag[dragging][dragend]::after {
        content: "dragend";
      }

      .zone-demo.reflect tp-drag[dragging][dragend][dropaccepted]::after {
        content: "dragend  dropaccepted";
      }
    </style>
    <div class="zone-demo reflect">
      <div class="row">
        <tp-drag name="token" replaceclone>Drag me</tp-drag>
      </div>
      <div class="zones">
        <tp-dropzone name="left" accept="token" @tp-dropzone-drop=${acceptIntoRow} @tp-dropzone-drop-end=${moveIntoRow}>
          <strong>name="left" accept="token"</strong>
          <div class="row"></div>
        </tp-dropzone>
        <tp-dropzone name="right" accept="token">
          <strong>name="right" accept="token" (never calls acceptDrop)</strong>
          <div class="row"></div>
        </tp-dropzone>
        <tp-dropzone name="other" accept="something-else">
          <strong>name="other" accept="something-else"</strong>
        </tp-dropzone>
      </div>
    </div>
  `,
};

export const EventLog: Story = {
  name: "Event log",
  parameters: {
    docs: {
      description: {
        story:
          "Every `tp-drag-*` and `tp-dropzone-*` event bubbles, so one listener on a container sees them all. Drop on **Accepting** (it calls `acceptDrop()`) to get the full sequence ending with `tp-dropzone-drop-end`; drop on **Observing** to see the drop rejected. Repeated `…over` events are collapsed.",
      },
    },
  },
  render: () => {
    let list: HTMLOListElement | null = null;
    const log = (event: Event): void => {
      const { type, dragData } = event as DragDropEvent;
      const zone = (event as DragDropEvent).dropzoneTarget?.deref();
      const target = type.startsWith("tp-dropzone-") ? "zone" : "item";
      const text = `${type.padEnd(21)} on ${target}${zone ? ` · zone "${zone.name}"` : ""} · dragData ${JSON.stringify(dragData)}`;

      list ??= (event.currentTarget as HTMLElement).querySelector("ol");

      // `tp-dropzone-over` and `tp-drag-zone-over` alternate, so look at the two newest entries
      const recent = Array.from(list!.children).slice(0, 2) as HTMLLIElement[];
      const repeated = type.endsWith("over") && recent.find((entry) => entry.dataset["text"] === text);

      if (repeated) {
        repeated.dataset["count"] = String(Number(repeated.dataset["count"]) + 1);
        repeated.textContent = `${text}  ×${repeated.dataset["count"]}`;

        return;
      }

      const entry = document.createElement("li");

      entry.dataset["text"] = text;
      entry.dataset["count"] = "1";
      entry.textContent = text;
      list!.prepend(entry);
    };
    const clear = (event: Event): void => {
      (event.currentTarget as HTMLElement).closest(".zone-demo")!.querySelector("ol")!.replaceChildren();
    };

    return html`
      ${styles}
      <style>
        .zone-demo.log tp-dropzone[itemdragged] {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .zone-demo.log ol {
          height: 220px;
          margin: 0;
          padding: 8px 8px 8px 2.5em;
          overflow: auto;
          border-radius: 8px;
          background: #18181b;
          color: #e4e4e7;
          font-family: ui-monospace, monospace;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre;
        }

        .zone-demo.log ol li:first-child {
          color: #93c5fd;
        }
      </style>
      <div
        class="zone-demo log"
        @tp-drag-start=${log}
        @tp-dropzone-enter=${log}
        @tp-drag-zone-enter=${log}
        @tp-dropzone-over=${log}
        @tp-drag-zone-over=${log}
        @tp-dropzone-leave=${log}
        @tp-drag-zone-leave=${log}
        @tp-dropzone-drop=${log}
        @tp-drag-drop=${log}
        @tp-dropzone-drop-end=${log}
        @tp-drag-end=${log}
      >
        <div class="row">
          <tp-drag name="parcel" data-drag-id="42" data-drag-weight="1.5kg" replaceclone>📦 Parcel #42</tp-drag>
        </div>
        <div class="zones">
          <tp-dropzone name="accepting" @tp-dropzone-drop=${(event: DragDropEvent) => event.acceptDrop(event.dragTarget.deref()?.preDragData.boundingRect)}>
            <strong>Accepting</strong>
            <small>calls acceptDrop(): the parcel flies back home, tp-dropzone-drop-end fires</small>
          </tp-dropzone>
          <tp-dropzone name="observing">
            <strong>Observing</strong>
            <small>no acceptDrop(): the drop is rejected</small>
          </tp-dropzone>
        </div>
        <div class="row" style="justify-content: space-between; align-items: center; min-height: 0">
          <strong>Events (newest first)</strong>
          <button type="button" @click=${clear}>Clear</button>
        </div>
        <ol reversed></ol>
      </div>
    `;
  },
};
