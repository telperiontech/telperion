import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import "./drag-element";
import "./dropzone-element";

import type { DragElement } from "./drag-element";
import type { DragDropEvent } from "./drag-drop-event";

interface Task {
  id: string;
  title: string;
  points: number;
  kind: "task" | "bug";
}

interface Column {
  name: string;
  title: string;
  accept: string;
  tasks: Task[];
}

const COLUMNS: Column[] = [
  {
    name: "todo",
    title: "To do",
    accept: "task, bug",
    tasks: [
      { id: "T-1", title: "Write the release notes", points: 2, kind: "task" },
      { id: "B-7", title: "Tooltip flickers on hover", points: 3, kind: "bug" },
      { id: "T-4", title: "Add dark mode tokens", points: 5, kind: "task" },
    ],
  },
  {
    name: "doing",
    title: "In progress",
    accept: "task, bug",
    tasks: [{ id: "T-2", title: "Migrate the router", points: 8, kind: "task" }],
  },
  {
    name: "done",
    title: "Done",
    accept: "task, bug",
    tasks: [{ id: "T-3", title: "Set up CI", points: 3, kind: "task" }],
  },
];
const pointsOf = (tasks: Task[]): number => tasks.reduce((sum, task) => sum + task.points, 0);
/** Landing slots, created on `tp-dropzone-drop` and replaced by the card on `tp-dropzone-drop-end` */
const landingSlots = new WeakMap<DragElement, HTMLElement>();
/**
 * Reserves the card's future place at the end of the column and lets the card fly there:
 * the slot's rectangle is exactly where the card ends up once it is moved into the list.
 */
const onDrop = (event: DragDropEvent): void => {
  const zone = event.dropzoneTarget?.deref();
  const card = event.dragTarget.deref();

  if (!zone || !card) return;

  const slot = document.createElement("div");

  slot.className = "landing-slot";
  slot.style.height = `${card.preDragData.boundingRect.height}px`;
  zone.querySelector(".cards")!.append(slot);
  landingSlots.set(card, slot);

  event.acceptDrop(slot.getBoundingClientRect());
};
const updateTotal = (zone: Element): void => {
  const cards = Array.from(zone.querySelectorAll<DragElement>(".cards > tp-drag"));
  const points = cards.reduce((sum, card) => sum + Number(card.dragData["points"] ?? 0), 0);

  zone.querySelector(".total")!.textContent = `${cards.length} · ${points} pts`;
};
/** The landing animation is over: move the card for real and refresh both columns */
const onDropEnd = (event: DragDropEvent): void => {
  const zone = event.dropzoneTarget?.deref();
  const card = event.dragTarget.deref();
  const slot = card && landingSlots.get(card);

  if (!zone || !card || !slot) return;

  const source = card.closest("tp-dropzone");

  slot.replaceWith(card);
  landingSlots.delete(card);
  updateTotal(zone);

  if (source && source !== zone) updateTotal(source);
};
const styles = html`
  <style>
    .board {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      max-width: 780px;
      font-family: system-ui, sans-serif;
    }

    .board tp-dropzone {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 280px;
      padding: 12px;
      border: 2px solid transparent;
      border-radius: 12px;
      background: #f4f4f5;
      transition: border-color 0.15s, background-color 0.15s;
    }

    /* Every column that could take the card while one is dragged */
    .board tp-dropzone[acceptabledrag] {
      border-style: dashed;
      border-color: #d4d4d8;
    }

    /* The column under the pointer */
    .board tp-dropzone[itemdragged] {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .board header {
      display: flex;
      justify-content: space-between;
      color: #3f3f46;
      font-size: 13px;
      font-weight: 600;
    }

    .board header .total {
      color: #71717a;
      font-weight: 500;
    }

    .board .cards {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 8px;
    }

    .board :is(tp-drag, tp-drag-clone) {
      display: block;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      font-size: 14px;
    }

    .board tp-drag {
      background: white;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
      cursor: grab;
      user-select: none;
    }

    .board tp-drag[dragging] {
      cursor: grabbing;
      box-shadow: 0 14px 30px rgb(0 0 0 / 0.18);
    }

    .board tp-drag[dragging]:not([dragend]) {
      rotate: 2deg;
    }

    /* The placeholder left behind by replaceclone */
    .board tp-drag-clone {
      border: 2px dashed #d4d4d8;
      color: transparent;
    }

    .board tp-drag-clone * {
      visibility: hidden;
    }

    .board .landing-slot {
      flex-shrink: 0;
    }

    .board .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      color: #71717a;
      font-size: 12px;
    }

    .board .kind {
      padding: 1px 6px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #0369a1;
    }

    .board .kind.bug {
      background: #fee2e2;
      color: #b91c1c;
    }

    .board .meta .points {
      margin-left: auto;
    }
  </style>
`;
const card = (task: Task) => html`
  <tp-drag name=${task.kind} data-drag-id=${task.id} data-drag-points=${task.points} replaceclone>
    ${task.title}
    <div class="meta">
      <span class="kind ${task.kind}">${task.kind}</span>
      <span>${task.id}</span>
      <span class="points">${task.points} pts</span>
    </div>
  </tp-drag>
`;
const meta: Meta = {
  title: "Elements/Drag & Drop/Board",
  component: "tp-drag",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A complete drag and drop flow: columns are `<tp-dropzone>`s, cards are `<tp-drag>`s carrying their data in `data-drag-*` attributes.",
      },
    },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "Kanban board",
  parameters: {
    docs: {
      description: {
        story:
          "Drag cards between columns. Each column reserves a slot on `tp-dropzone-drop` and passes its rectangle to `acceptDrop()`, so the card lands exactly where it ends up; `tp-dropzone-drop-end` then moves the card and recomputes the totals from `dragData`.",
      },
    },
  },
  render: () => html`
    ${styles}
    <div class="board">
      ${COLUMNS.map(
        (column) => html`
          <tp-dropzone name=${column.name} accept=${column.accept} @tp-dropzone-drop=${onDrop} @tp-dropzone-drop-end=${onDropEnd}>
            <header>
              <span>${column.title}</span>
              <span class="total">${column.tasks.length} · ${pointsOf(column.tasks)} pts</span>
            </header>
            <div class="cards">${column.tasks.map(card)}</div>
          </tp-dropzone>
        `,
      )}
    </div>
  `,
};
