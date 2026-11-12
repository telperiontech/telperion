import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import "./drag-element";
import "./drag-handle-element";

interface Args {
  draggingStrategy: "move" | "copyMove";
  replaceClone: boolean;
  disabled: boolean;
  offsetX: number;
  offsetY: number;
}

const styles = html`
  <style>
    .drag-demo {
      display: grid;
      gap: 20px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
    }

    .drag-demo p {
      margin: 0;
      color: #71717a;
      font-size: 13px;
    }

    .drag-demo .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .drag-demo :where(tp-drag, tp-drag-clone, .chip) {
      display: block;
      box-sizing: border-box;
      padding: 10px 16px;
      border: 1px solid #d4d4d8;
      border-radius: 8px;
      background: white;
    }

    .drag-demo tp-drag {
      cursor: grab;
      user-select: none;
    }

    .drag-demo tp-drag.accent {
      border-color: #2563eb;
      background: #2563eb;
      color: white;
    }

    .drag-demo tp-drag[dragging] {
      cursor: grabbing;
      box-shadow: 0 12px 28px rgb(0 0 0 / 0.2);
    }

    .drag-demo tp-drag[disabled] {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .drag-demo tp-drag-clone {
      border: 2px dashed #a1a1aa;
      background: transparent;
      color: transparent;
    }

    .drag-demo tp-drag-clone * {
      visibility: hidden;
    }

    .drag-demo tp-drag-handle {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: #f4f4f5;
      color: #71717a;
      cursor: grab;
    }
  </style>
`;
const meta: Meta<Args> = {
  title: "Elements/Drag & Drop/Drag",
  component: "tp-drag",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "`<tp-drag>` makes its content draggable. The element itself follows the pointer while dragged, and animates back on release unless a `<tp-dropzone>` accepts it.",
      },
    },
  },
  argTypes: {
    draggingStrategy: {
      name: "draggingstrategy",
      control: { type: "inline-radio" },
      options: ["move", "copyMove"],
      description: "Sets `dataTransfer.effectAllowed`.",
    },
    replaceClone: { name: "replaceclone", control: { type: "boolean" }, description: "Keep a placeholder in place while dragging." },
    disabled: { control: { type: "boolean" } },
    offsetX: {
      name: "--tp-drag-offset-x",
      control: { type: "range", min: -60, max: 60, step: 4 },
      table: { category: "CSS custom properties" },
    },
    offsetY: {
      name: "--tp-drag-offset-y",
      control: { type: "range", min: -60, max: 60, step: 4 },
      table: { category: "CSS custom properties" },
    },
  },
  args: {
    draggingStrategy: "move",
    replaceClone: true,
    disabled: false,
    offsetX: 0,
    offsetY: 0,
  },
};

export default meta;

type Story = StoryObj<Args>;

export const Default: Story = {
  name: "Playground",
  parameters: {
    docs: {
      description: {
        story:
          "Drag the blue item and release it anywhere: with no drop zone accepting it, it returns home. Toggle `replaceclone` to see the neighbours close the gap, or offset it from the pointer with `--tp-drag-offset-x` / `--tp-drag-offset-y`.",
      },
    },
  },
  render: (args) => html`
    ${styles}
    <div class="drag-demo" style="--tp-drag-offset-x: ${args.offsetX}px; --tp-drag-offset-y: ${args.offsetY}px">
      <div class="row">
        <span class="chip">Before</span>
        <tp-drag
          class="accent"
          draggingstrategy=${args.draggingStrategy}
          ?replaceclone=${args.replaceClone}
          ?disabled=${args.disabled}
        >
          Drag me
        </tp-drag>
        <span class="chip">After</span>
      </div>
    </div>
  `,
};

export const Placeholder: Story = {
  name: "Placeholder (replaceclone)",
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "While dragged the element is taken out of the flow (`position: fixed`). With `replaceclone`, a `<tp-drag-clone>` copy holds its place; style it with the `tp-drag-clone` selector.",
      },
    },
  },
  render: () => html`
    ${styles}
    <div class="drag-demo">
      <p>Without <code>replaceclone</code>: the row closes the gap.</p>
      <div class="row">
        <span class="chip">One</span>
        <tp-drag class="accent">Drag me</tp-drag>
        <span class="chip">Three</span>
      </div>
      <p>With <code>replaceclone</code>: a dashed placeholder keeps the space.</p>
      <div class="row">
        <span class="chip">One</span>
        <tp-drag class="accent" replaceclone>Drag me</tp-drag>
        <span class="chip">Three</span>
      </div>
    </div>
  `,
};

export const Handles: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Once a `<tp-drag>` contains a `<tp-drag-handle>`, only its handles start a drag, so the rest of the content stays selectable and clickable. An element can have several handles.",
      },
    },
  },
  render: () => html`
    ${styles}
    <style>
      .drag-demo .handle-row {
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 360px;
        cursor: auto;
        user-select: text;
      }

      .drag-demo .handle-row button {
        margin-left: auto;
      }

      .drag-demo .handle-card {
        display: grid;
        gap: 8px;
        max-width: 360px;
        cursor: auto;
        user-select: text;
      }

      .drag-demo .handle-card tp-drag-handle {
        display: block;
        width: auto;
        height: auto;
        padding: 4px;
        text-align: center;
      }
    </style>
    <div class="drag-demo">
      <tp-drag class="handle-row" replaceclone>
        <tp-drag-handle title="Drag">⠿</tp-drag-handle>
        Select this text, or click the button
        <button type="button">Button</button>
      </tp-drag>
      <tp-drag class="handle-card" replaceclone>
        <tp-drag-handle>top handle</tp-drag-handle>
        Two handles: grab either bar.
        <tp-drag-handle>bottom handle</tp-drag-handle>
      </tp-drag>
    </div>
  `,
};

export const Nested: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Drag elements nest: the innermost `<tp-drag>` under the pointer wins. Here the panel moves by its header handle, and each chip inside it moves on its own.",
      },
    },
  },
  render: () => html`
    ${styles}
    <style>
      .drag-demo .panel {
        display: grid;
        gap: 10px;
        max-width: 360px;
        padding: 0 0 12px;
        overflow: hidden;
        cursor: auto;
      }

      .drag-demo .panel > tp-drag-handle {
        display: block;
        width: auto;
        height: auto;
        padding: 8px 12px;
        border-radius: 0;
        font-weight: 600;
      }

      .drag-demo .panel .row {
        padding: 0 12px;
      }
    </style>
    <div class="drag-demo">
      <tp-drag class="panel" replaceclone>
        <tp-drag-handle>⠿ Panel (drag by this header)</tp-drag-handle>
        <div class="row">
          <tp-drag replaceclone>Chip A</tp-drag>
          <tp-drag replaceclone>Chip B</tp-drag>
          <tp-drag replaceclone>Chip C</tp-drag>
        </div>
      </tp-drag>
    </div>
  `,
};

export const Disabled: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story: "`disabled` blocks dragging and is reflected, so it can be styled.",
      },
    },
  },
  render: () => html`
    ${styles}
    <div class="drag-demo">
      <div class="row">
        <tp-drag replaceclone>Enabled</tp-drag>
        <tp-drag replaceclone disabled>Disabled</tp-drag>
      </div>
    </div>
  `,
};

export const Styling: Story = {
  name: "Styling the drag",
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Style `[dragging]` for the lifted look; `transform-origin` is set to the grab point, so scaling grows around the pointer. `[dragend]` marks the release animation, whose duration and easing are yours to change. Set `transition-duration` / `transition-timing-function`, never the `transition` shorthand.",
      },
    },
  },
  render: () => html`
    ${styles}
    <style>
      .drag-demo .lift[dragging] {
        scale: 1.08;
        rotate: -3deg;
        box-shadow: 0 20px 40px rgb(37 99 235 / 0.35);
      }

      .drag-demo .lift[dragend] {
        scale: 1;
        rotate: 0deg;
      }

      .drag-demo .springy {
        transition-duration: 0.6s;
        transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .drag-demo .ghost[dragging] {
        opacity: 0.6;
        outline: 2px solid #2563eb;
        outline-offset: 3px;
      }
    </style>
    <div class="drag-demo">
      <div class="row">
        <tp-drag class="accent lift" replaceclone>Lift &amp; tilt</tp-drag>
        <tp-drag class="accent springy" replaceclone>Springy return</tp-drag>
        <tp-drag class="accent ghost" replaceclone>Ghost</tp-drag>
      </div>
    </div>
  `,
};
