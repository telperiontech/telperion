import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import "./mermaid-element";

/**
 * `<tp-mermaid>` renders a [Mermaid](https://mermaid.js.org) diagram to SVG.
 * Mermaid loads lazily on the first diagram; colors are `--tp-mermaid-*` CSS
 * variables.
 */
interface Args {
  code: string;
  label: string;
}

const FLOWCHART = `flowchart LR
  browser([browser])
  frpc(["frpc<br/>user=alice"])

  subgraph gateway
    caddy[Caddy]
    frps[frps]
    gate[frp-gate]
  end

  browser -- HTTPS --> caddy
  caddy -- HTTP --> frps
  caddy -- "ask" --> gate
  frps -- plugin --> gate
  frpc -- ":7000" --> frps`;
const meta: Meta<Args> = {
  title: "Elements/Mermaid",
  component: "tp-mermaid",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    code: {
      control: { type: "text" },
    },
    label: {
      control: { type: "text" },
    },
  },
  args: {
    code: FLOWCHART,
    label: "",
  },
};

export default meta;

type Story = StoryObj<Args>;

/** Interactive playground: edit the source and the diagram re-renders. */
export const Playground: Story = {
  render: args => html`<tp-mermaid label=${args.label} .code=${args.code}></tp-mermaid>`,
};

/** The source can be the element's text, dedented. Escape `<` there, or use a `<template>`. */
export const TextContent: Story = {
  render: () => html`
    <tp-mermaid>
      sequenceDiagram
        participant frpc
        participant frps
        participant gate as frp-gate
        frpc->>frps: Login (user, token)
        frps->>gate: plugin: Login
        gate--)frps: allow
        frps--)frpc: ok
    </tp-mermaid>
  `,
};

/** A `<template>` child keeps `-->` and `<br/>` as written. */
export const Template: Story = {
  render: () => html`
    <tp-mermaid label="Two steps">
      <template>
        flowchart TD
          a["first line<br/>second line"] --> b{decide}
          b -- yes --> c[done]
          b -- no --> a
      </template>
    </tp-mermaid>
  `,
};

/** A source Mermaid cannot parse shows the error and the source. */
export const ParseError: Story = {
  render: () => html`<tp-mermaid .code=${"flowchart LR\n  a -->"}></tp-mermaid>`,
};

/** Colors are CSS variables, set on `tp-mermaid` or any ancestor. */
export const Theming: Story = {
  render: () => html`
    <div
      style="
        padding: 1rem;
        border-radius: 0.75rem;
        background: hsl(222 20% 9%);
        --tp-mermaid-foreground: hsl(220 15% 85%);
        --tp-mermaid-background: hsl(222 20% 9%);
        --tp-mermaid-accent: hsl(286 60% 65%);
      "
    >
      <tp-mermaid .code=${FLOWCHART}></tp-mermaid>
    </div>
  `,
};
