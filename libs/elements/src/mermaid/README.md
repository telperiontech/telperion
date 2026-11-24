# `<tp-mermaid>`

A [Mermaid](https://mermaid.js.org) diagram (flowchart, sequence, class, state, ER, Gantt, …), rendered to SVG.

```html
<tp-mermaid label="Request flow">
  <template>
    flowchart LR
      browser -- HTTPS --> caddy[Caddy] --> app["app<br/>:3000"]
  </template>
</tp-mermaid>
```

## Highlights

- **Lazy.** Mermaid is imported on the first diagram of the page, so registering the element costs next to nothing.
- **CSS-variable theming.** Mermaid's `base` theme, colored from `--tp-mermaid-*` variables whose defaults come from the shared `--tp-color-*` palette, in the element's own font.
- **Strict.** Mermaid runs with `securityLevel: "strict"`: no scripts or click handlers in diagrams.
- **Errors in place.** A source Mermaid cannot parse shows the message and the source instead of a broken diagram.

## Setup

```ts
import "@telperion/elements/mermaid";
```

`<tp-mermaid>` is **not** re-exported from the root `@telperion/elements` entry: Mermaid is large, and the all-in-one IIFE would have to inline it.

### Script tag (no bundler)

```html
<script src="https://unpkg.com/@telperion/elements/iife/mermaid/cdn.js"></script>
```

The IIFE cannot code-split, so it imports Mermaid at runtime from jsDelivr (pinned to the bundled Mermaid version). To self-host it, serve `mermaid/dist/mermaid.esm.min.mjs` with its `chunks/` folder and point the loader at it:

```js
TelperionElements.Mermaid.setMermaidCdnUrl("https://my.cdn/mermaid/mermaid.esm.min.mjs");
```

The same CDN loader is available to bundler users via `@telperion/elements/mermaid/cdn`.

## Attributes / properties

| Attribute | Property | Type                                  | Default     | Description |
| --------- | -------- | ------------------------------------- | ----------- | ----------- |
| `label`   | `label`  | `string`                              | `""`        | Accessible name. When set, the diagram is exposed as one image with this name. |
| `status`  | `status` | `"pending" \| "rendered" \| "error"` | `"pending"` | Read-only render state, reflected for styling. |
| &mdash;   | `code`   | `string \| undefined`                 | &mdash;     | Source override (handy in frameworks). Set back to `undefined` to use the children again. |

Read-only: `source` (the dedented source) and `renderComplete` (a promise for the current render pass). Method: `refresh()` renders again with the current theme.

## Source

In priority order:

1. The `code` property.
2. A direct `<template>` child. The entities the HTML serializer adds are turned back into characters, so `-->`, `&` and `<br/>` labels are written as they are.
3. The element's text content. It is parsed as HTML, so escape `<` there (`&lt;br/&gt;`). `-->` needs no escaping.

The source is dedented (common indentation and surrounding blank lines removed), so it can be indented to match the surrounding HTML. Light-DOM changes re-render the diagram.

A diagram's own [frontmatter config or `%%{init}%%` directive](https://mermaid.js.org/config/configuration.html) is applied on top of the element's theme, except for `securityLevel`.

## Events

| Event               | `detail`                                  | When |
| ------------------- | ----------------------------------------- | ---- |
| `tp-mermaid-render` | `{ diagramType }` or `{ error }`          | After each render pass. |

It bubbles and is composed.

## Theming

Mermaid bakes colors into the SVG, so the element reads its resolved `--tp-mermaid-*` variables before each render. They may be set on `tp-mermaid` or any ancestor, in any CSS color syntax (`color-mix()`, `oklch()`, …):

```css
.dark {
  --tp-mermaid-foreground: hsl(220 15% 85%);
  --tp-mermaid-background: hsl(222 20% 9%);
  --tp-mermaid-accent: hsl(286 60% 65%);
}
```

A change of `prefers-color-scheme` re-renders the diagram. After changing the variables in any other way (e.g. a theme class), call `refresh()`.

| Variable | Default |
| -------- | ------- |
| `--tp-mermaid-foreground` | `--tp-color-contrast` |
| `--tp-mermaid-background` | `--tp-color-white`: the surface the diagram sits on, used for edge labels and mixed into the defaults |
| `--tp-mermaid-accent` | `--tp-color-primary` |
| `--tp-mermaid-node-background` | 10% accent |
| `--tp-mermaid-node-border` | 55% accent |
| `--tp-mermaid-line` | 60% foreground |
| `--tp-mermaid-cluster-background` | 4% foreground |
| `--tp-mermaid-cluster-border` | 25% foreground |
| `--tp-mermaid-note-background` | 18% `--tp-color-warning` |
| `--tp-mermaid-font-family` | inherited |
| `--tp-mermaid-font-size` | inherited |
| `--tp-mermaid-align` | `center` |

### Parts

`diagram`, `error`, `source`.

```css
tp-mermaid::part(diagram) { justify-content: start; }
```

## Custom Mermaid sources

`setMermaidLoader(loader)` replaces how Mermaid is fetched (call it before the first render). A loader resolves to the Mermaid API:

```ts
import { setMermaidLoader } from "@telperion/elements/mermaid";

setMermaidLoader(() => import("mermaid").then(module => module.default));
```
