import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import "./portal-element";
import "./portal-outlet-element";

const meta: Meta = {
  title: "Elements/Portal",
  component: "tp-portal",
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj;

const styles = html`
  <style>
    .portal-demo {
      display: grid;
      gap: 1rem;
      font-family: system-ui, sans-serif;
    }
    .portal-demo .box {
      border: 1px dashed #a1a1aa;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      min-height: 2.5rem;
    }
    .portal-demo .box > small {
      display: block;
      color: #71717a;
      margin-block-end: 0.5rem;
    }
  </style>
`;

/**
 * The portal's children are *moved* into the outlet with the same `name`.
 * The click counter proves the listener (and its state) moved with them.
 */
export const Basic: Story = {
  render: () => {
    let clicks = 0;
    const onClick = (event: Event): void => {
      (event.currentTarget as HTMLElement).textContent = `Clicked ${++clicks}×`;
    };
    return html`
      ${styles}
      <div class="portal-demo">
        <div class="box">
          <small>Where &lt;tp-portal name="foo"&gt; is declared</small>
          <tp-portal name="foo">
            Foo text
            <section><button @click=${onClick}>Click me</button></section>
          </tp-portal>
        </div>
        <div class="box">
          <small>&lt;tp-portal-outlet name="foo"&gt;</small>
          <tp-portal-outlet name="foo"></tp-portal-outlet>
        </div>
      </div>
    `;
  },
};

/**
 * Several outlets may share a name: the most recently connected one wins and
 * the previous one takes over when it leaves. Input state survives the moves.
 */
export const SwitchingOutlets: Story = {
  render: () => {
    const toggle = (event: Event): void => {
      const stage = (event.currentTarget as HTMLElement).closest(".portal-demo")!;
      const slot = stage.querySelector("#second-slot")!;
      const existing = slot.querySelector("tp-portal-outlet");
      if (existing) existing.remove();
      else slot.append(Object.assign(document.createElement("tp-portal-outlet"), { name: "switch" }));
    };
    return html`
      ${styles}
      <div class="portal-demo">
        <tp-portal name="switch">
          <input placeholder="Type, then toggle the second outlet" style="width: 18rem" />
        </tp-portal>
        <button @click=${toggle}>Toggle second outlet</button>
        <div class="box">
          <small>First outlet</small>
          <tp-portal-outlet name="switch"></tp-portal-outlet>
        </div>
        <div class="box" id="second-slot"><small>Second outlet (added on demand)</small></div>
      </div>
    `;
  },
};

/**
 * Lit (like React, Angular and Vue) keeps updating the portal after its
 * nodes moved; the updates land in the outlet.
 */
export const FrameworkUpdates: Story = {
  render: () => {
    const add = (event: Event): void => {
      const portal = (event.currentTarget as HTMLElement).closest(".portal-demo")!.querySelector("tp-portal")!;
      const item = document.createElement("li");
      item.textContent = `Item ${portal.projectedNodes.filter((n) => n instanceof HTMLLIElement).length + 1}`;
      portal.appendChild(item);
    };
    const clear = (event: Event): void => {
      (event.currentTarget as HTMLElement).closest(".portal-demo")!.querySelector("tp-portal")!.replaceChildren();
    };
    return html`
      ${styles}
      <div class="portal-demo">
        <div>
          <button @click=${add}>portal.appendChild(li)</button>
          <button @click=${clear}>portal.replaceChildren()</button>
        </div>
        <tp-portal name="list"></tp-portal>
        <div class="box">
          <small>&lt;ul&gt;&lt;tp-portal-outlet name="list"&gt;</small>
          <ul><tp-portal-outlet name="list"></tp-portal-outlet></ul>
        </div>
      </div>
    `;
  },
};
