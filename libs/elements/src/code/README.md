# `<tp-code>`

Syntax-highlighted code, inline or as a block, powered by [Shiki](https://shiki.style) (TextMate grammars &mdash; the same highlighting as VS Code).

```html
<p>Run <tp-code language="sh">pnpm install</tp-code> first.</p>

<tp-code variant="block" language="ts" line-numbers highlight-lines="2" copyable>
  const answer = 42;
  console.log(answer);
</tp-code>
```

## Highlights

- **Every Shiki language, lazily.** `language` accepts any Shiki id or alias (`ts`, `tsx`, `vue`, `sh`, `rust`, …). Each grammar is downloaded once per page, the first time it is used.
- **CSS-variable theming only.** Tokens are colored with `--tp-code-*` variables whose defaults come from the shared `--tp-color-*` palette. No Shiki theme is shipped.
- **No layout shift.** Plain text renders immediately and is swapped for highlighted tokens once the grammar loads.
- **No WASM.** Uses Shiki's pure-JavaScript regex engine.
- **Framework-safe.** Renders into shadow DOM, leaving the light-DOM children untouched as the source of truth; changes to them re-highlight.

## Setup

```ts
import "@telperion/elements/code";
```

`<tp-code>` is **not** re-exported from the root `@telperion/elements` entry. Its loader references every grammar through `import()`; bundlers split those into lazy chunks, but the all-in-one IIFE would have to inline all of them.

### Script tag (no bundler)

```html
<script src="https://unpkg.com/@telperion/elements/iife/code/cdn.js"></script>
```

The IIFE cannot code-split, so it fetches grammars at runtime from jsDelivr (`@shikijs/langs`, pinned to the bundled Shiki version). To self-host the grammars, mirror `@shikijs/langs/dist/` and point the loader at it:

```js
TelperionElements.Code.setLanguageCdnBaseUrl("https://my.cdn/shiki-langs/");
```

The same CDN loader is available to bundler users via `@telperion/elements/code/cdn`.

## Attributes / properties

| Attribute         | Property         | Type                   | Default    | Description |
| ----------------- | ---------------- | ---------------------- | ---------- | ----------- |
| `variant`         | `variant`        | `"inline" \| "block"`  | `"inline"` | Layout. |
| `language`        | `language`       | `string`               | `""`       | Shiki id or alias. Empty, `text`, `plain`, `plaintext`, `txt`, or unknown → plain text (unknown logs one warning). |
| `line-numbers`    | `lineNumbers`    | `boolean`              | `false`    | Block only. Shows line numbers. |
| `line-start`      | `lineStart`      | `number`               | `1`        | Block only. Number of the first line. |
| `highlight-lines` | `highlightLines` | `string`               | `""`       | Block only. Lines to emphasize, e.g. `"2, 4-6"`. Uses **displayed** numbers (respects `line-start`). |
| `copyable`        | `copyable`       | `boolean`              | `false`    | Block only. Shows a copy-to-clipboard button. |
| &mdash;           | `code`           | `string \| undefined`  | &mdash;    | Source override (handy in frameworks). Set back to `undefined` to use the children again. |

Read-only: `source` (the normalized code being shown) and `highlightComplete` (a promise for the current highlight pass). Method: `copy()`.

## Source

In priority order:

1. The `code` property.
2. A direct `<template>` child &mdash; its markup is used verbatim, so HTML samples need no escaping:
   ```html
   <tp-code variant="block" language="html">
     <template>
       <button class="primary">Save</button>
     </template>
   </tp-code>
   ```
3. The element's text content.

Raw text content is still parsed as HTML, so escape `<` and `&` there (`Promise&lt;User&gt;`) or use a `<template>`. Template markup is the browser's serialization of it: attribute quoting is normalized and boolean attributes become `required=""`.

Block sources are dedented (common indentation and surrounding blank lines removed), so code can be indented to match the surrounding HTML. Inline sources are trimmed.

## Events

| Event               | `detail`                                   | When |
| ------------------- | ------------------------------------------ | ---- |
| `tp-code-highlight` | `{ language: string; highlighted: boolean }` | After each highlight pass has rendered. `highlighted` is `false` for plain/unknown languages. |
| `tp-code-copy`      | `{ code: string; success: boolean }`       | After the copy button (or `copy()`) is used. |

Both bubble and are composed.

## Theming

All colors are CSS variables and may be set on `tp-code` **or any ancestor**:

```css
.dark {
  --tp-code-foreground: hsl(220 15% 85%);
  --tp-code-background: hsl(220 15% 12%);
  --tp-code-token-keyword: hsl(286 60% 70%);
  --tp-code-token-string: hsl(95 40% 62%);
}
```

| Variable | Default |
| -------- | ------- |
| `--tp-code-foreground` | `--tp-color-contrast` |
| `--tp-code-background` | 6% tint of the foreground |
| `--tp-code-accent-strength` | `80%` &mdash; how much palette color the token defaults keep vs. the foreground |
| `--tp-code-token-keyword` | from `--tp-color-secondary` |
| `--tp-code-token-function` | from `--tp-color-primary` |
| `--tp-code-token-constant` | primary/secondary blend |
| `--tp-code-token-string` | from `--tp-color-success` |
| `--tp-code-token-string-expression` | softer string color |
| `--tp-code-token-parameter` | from `--tp-color-warning` |
| `--tp-code-token-comment` | 55% foreground |
| `--tp-code-token-punctuation` | 75% foreground |
| `--tp-code-token-link` | function color |
| `--tp-code-token-inserted` / `-deleted` / `-changed` | string / `--tp-color-danger` / parameter |
| `--tp-code-ansi-{black,red,green,yellow,blue,magenta,cyan,white}` (+ `-bright-*`) | palette-based (`ansi` language) |
| `--tp-code-line-number-color` | 40% foreground |
| `--tp-code-line-number-gap` | `1.5em` |
| `--tp-code-line-highlight-background` | 14% `--tp-color-primary` |
| `--tp-code-line-highlight-border-color` | `--tp-color-primary` |
| `--tp-code-copy-background` / `-color` / `-success-color` | `Canvas` / foreground / `--tp-color-success` |
| `--tp-code-font-family` | `ui-monospace, …, monospace` |
| `--tp-code-font-size` | `0.875em` |
| `--tp-code-line-height` | `1.6` (block) |
| `--tp-code-tab-size` | `2` |
| `--tp-code-radius` | `0.3em` inline, `0.5em` block |
| `--tp-code-inline-padding` | `0.1em 0.35em` |
| `--tp-code-padding-block` / `--tp-code-padding-inline` | `1em` / `1em` (block) |

The color variables map to Shiki's [CSS-variables theme](https://shiki.style/guide/theme-colors#css-variables-theme) token groups. That theme distinguishes about a dozen token kinds, which keeps palettes small and consistent.

### Parts

`pre`, `code`, `line`, `highlighted-line`, `copy-button`.

```css
tp-code::part(copy-button) { border-radius: 999px; }
```

## Custom grammar sources

`setLanguageLoader(loader)` replaces how grammars are fetched (call it before the first highlight). A loader receives a lower-cased id/alias and resolves to Shiki `LanguageRegistration[]` (the requested language last) or `undefined`:

```ts
import { setLanguageLoader } from "@telperion/elements/code";

setLanguageLoader(async name => (name === "ts" ? (await import("@shikijs/langs/typescript")).default : undefined));
```
