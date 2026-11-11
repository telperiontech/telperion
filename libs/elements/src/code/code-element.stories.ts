import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import "./code-element";
import type { CodeVariant } from "./types";

/**
 * `<tp-code>` renders syntax-highlighted code with [Shiki](https://shiki.style).
 * Every Shiki language loads lazily on first use; colors are entirely
 * `--tp-code-*` CSS variables.
 */
interface Args {
  variant: CodeVariant;
  language: string;
  code: string;
  lineNumbers: boolean;
  lineStart: number;
  highlightLines: string;
  copyable: boolean;
}

const VARIANTS: CodeVariant[] = ["inline", "block"];
const LANGUAGES = ["ts", "js", "tsx", "html", "css", "json", "sh", "python", "rust", "go", "sql", "yaml", "text"];
const SAMPLE = `interface User {
  id: number;
  name: string;
}

export async function getUser(id: number): Promise<User> {
  // Fetch a single user by id
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}`;
const meta: Meta<Args> = {
  title: "Elements/Code",
  component: "tp-code",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: { type: "inline-radio" },
      options: VARIANTS,
    },
    language: {
      control: { type: "select" },
      options: LANGUAGES,
    },
    code: {
      control: { type: "text" },
    },
    lineNumbers: {
      name: "line-numbers",
      control: { type: "boolean" },
      table: { category: "block" },
    },
    lineStart: {
      name: "line-start",
      control: { type: "number", min: 0 },
      table: { category: "block" },
    },
    highlightLines: {
      name: "highlight-lines",
      control: { type: "text" },
      table: { category: "block" },
    },
    copyable: {
      control: { type: "boolean" },
      table: { category: "block" },
    },
  },
  args: {
    variant: "block",
    language: "ts",
    code: SAMPLE,
    lineNumbers: true,
    lineStart: 1,
    highlightLines: "6-9",
    copyable: true,
  },
};

export default meta;

type Story = StoryObj<Args>;

/** Interactive playground. */
export const Playground: Story = {
  render: args => html`
    <tp-code
      variant=${args.variant}
      language=${args.language}
      line-start=${args.lineStart}
      highlight-lines=${args.highlightLines}
      ?line-numbers=${args.lineNumbers}
      ?copyable=${args.copyable}
      .code=${args.code}
    ></tp-code>
  `,
};

/** `variant="inline"` (the default) flows with surrounding text. */
export const Inline: Story = {
  render: () => html`
    <p style="font-family: system-ui, sans-serif; line-height: 1.6; max-width: 40rem">
      Install with <tp-code language="sh">pnpm add @telperion/elements</tp-code>, then import
      <tp-code language="ts">import "@telperion/elements/code";</tp-code> and use
      <tp-code language="html" .code=${`<tp-code language="ts">`}></tp-code> anywhere.
    </p>
  `,
};

/** `variant="block"` dedents its content, so it can be indented with the surrounding markup. */
export const Block: Story = {
  render: () => html`
    <tp-code variant="block" language="rust">
      fn main() {
          let greeting = "Hello";
          println!("{greeting}, world!");
      }
    </tp-code>
  `,
};

/** Line numbers, a custom start line, and highlighted lines (in displayed numbers). */
export const LineNumbersAndHighlights: Story = {
  render: () => html`
    <tp-code variant="block" language="python" line-numbers line-start="40" highlight-lines="41, 44-45">
      def fibonacci(n: int) -> list[int]:
          """Return the first n Fibonacci numbers."""
          sequence = [0, 1]
          while len(sequence) < n:
              sequence.append(sequence[-1] + sequence[-2])
          return sequence[:n]
    </tp-code>
  `,
};

/** `copyable` adds a copy button (visible on hover/focus, always on touch). */
export const Copyable: Story = {
  render: () => html`
    <tp-code variant="block" language="sh" copyable>
      pnpm add @telperion/elements
      pnpm nx run elements:build
    </tp-code>
  `,
};

/** HTML samples go inside a `<template>` child, so they need no escaping. */
export const HtmlTemplate: Story = {
  render: () => html`
    <tp-code variant="block" language="html" line-numbers copyable>
      <template>
        <form class="signup">
          <label for="email">Email</label>
          <input id="email" type="email" required />
          <tp-button type="submit" color="primary">Subscribe</tp-button>
        </form>
      </template>
    </tp-code>
  `,
};

const GALLERY: [string, string][] = [
  ["tsx", `export const Hello = ({ name }: { name: string }) => <h1>Hello, {name}!</h1>;`],
  ["css", `.card:hover {\n  transform: translateY(-2px);\n  box-shadow: 0 4px 12px rgb(0 0 0 / 0.1);\n}`],
  ["json", `{\n  "name": "@telperion/elements",\n  "private": false,\n  "version": "1.0.0"\n}`],
  ["go", `func add(a, b int) int {\n\treturn a + b\n}`],
  ["sql", `SELECT id, name\nFROM users\nWHERE created_at > NOW() - INTERVAL '7 days';`],
  ["yaml", `services:\n  web:\n    image: nginx:alpine\n    ports: ["8080:80"]`],
  ["diff", `- const answer = 41;\n+ const answer = 42;`],
  ["vue", `<template>\n  <button @click="count++">{{ count }}</button>\n</template>\n\n<script setup>\nconst count = ref(0)\n</script>`],
];

/** A handful of the ~240 available languages; each grammar loads on demand. */
export const Languages: Story = {
  render: () => html`
    <div style="display: grid; gap: 1rem; font-family: system-ui, sans-serif">
      ${GALLERY.map(
        ([language, code]) => html`
          <section>
            <h4 style="margin: 0 0 0.25rem">${language}</h4>
            <tp-code variant="block" language=${language} .code=${code}></tp-code>
          </section>
        `,
      )}
    </div>
  `,
};

/** Themes are just CSS variables, set on `tp-code` or any ancestor. */
export const Theming: Story = {
  render: () => html`
    <style>
      .code-dark-theme {
        padding: 1rem;
        border-radius: 0.75rem;
        background: hsl(222 20% 9%);
        --tp-code-foreground: hsl(220 15% 85%);
        --tp-code-background: hsl(222 18% 14%);
        --tp-code-token-keyword: hsl(286 60% 72%);
        --tp-code-token-function: hsl(207 82% 68%);
        --tp-code-token-string: hsl(95 38% 62%);
        --tp-code-token-constant: hsl(29 54% 61%);
        --tp-code-token-comment: hsl(220 10% 50%);
        --tp-code-line-highlight-background: hsl(207 82% 68% / 0.12);
        --tp-code-line-highlight-border-color: hsl(207 82% 68%);
        --tp-code-copy-background: hsl(222 18% 20%);
      }
    </style>
    <div class="code-dark-theme">
      <tp-code variant="block" language="ts" line-numbers highlight-lines="7" copyable .code=${SAMPLE}></tp-code>
    </div>
  `,
};

/** Unknown languages (and `text`) render as plain text. */
export const PlainText: Story = {
  render: () => html`
    <tp-code variant="block" language="text">
      Plain text keeps   its spacing
      and line breaks.
    </tp-code>
  `,
};
