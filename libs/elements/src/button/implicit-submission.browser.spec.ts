import { afterEach, describe, expect, it } from "vitest";

import "./button.element";

import type { ButtonElement } from "./button.element";

/**
 * Synthetic key events never trigger the browser's own implicit submission, so these specs count
 * the submissions `<tp-button>` makes and check `defaultPrevented`, which is what cancels the
 * browser's own one in single-field forms.
 */
describe("<tp-button type=submit> implicit submission", () => {
  interface Fixture {
    form: HTMLFormElement;
    buttons: ButtonElement[];
    /** Number of `submit` events the form has dispatched. */
    submits: () => number;
    /** Number of clicks each `<tp-button>` received, in document order. */
    clicks: () => number[];
  }

  const setup = async (markup: string): Promise<Fixture> => {
    document.body.innerHTML = markup;

    const form = document.querySelector("form")!;
    const buttons = Array.from(document.querySelectorAll("tp-button"));
    await Promise.all(buttons.map(button => button.updateComplete));

    let submits = 0;
    form.addEventListener("submit", event => {
      event.preventDefault();
      submits++;
    });

    const clicks = buttons.map(() => 0);
    buttons.forEach((button, index) => button.addEventListener("click", () => clicks[index]++));

    return { form, buttons, submits: () => submits, clicks: () => [...clicks] };
  };
  const pressEnter = (target: Element, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);

    return event;
  };

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("submits a single-field form once and cancels the browser's own implicit submission", async () => {
    const { form, submits } = await setup(`
      <form>
        <input name="email" type="email" />
        <tp-button type="submit">Send</tp-button>
      </form>
    `);
    const event = pressEnter(form.querySelector("input")!);

    expect(submits()).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("submits a multi-field form once", async () => {
    const { form, submits } = await setup(`
      <form>
        <input name="email" type="email" />
        <input name="password" type="password" />
        <tp-button type="submit">Sign in</tp-button>
      </form>
    `);

    pressEnter(form.querySelector("[name=password]")!);

    expect(submits()).toBe(1);
  });

  it.each(["text", "search", "url", "tel", "email", "password", "date", "month", "week", "time", "datetime-local", "number"])(
    "submits on Enter in an input of type %s",
    async type => {
      const { form, submits } = await setup(`
        <form>
          <input name="field" type="${type}" />
          <tp-button type="submit">Send</tp-button>
        </form>
      `);

      pressEnter(form.querySelector("input")!);

      expect(submits()).toBe(1);
    },
  );

  it("submits nothing while the default button is disabled", async () => {
    const { form, submits, clicks } = await setup(`
      <form>
        <input name="email" type="email" />
        <tp-button type="submit" disabled>Send</tp-button>
      </form>
    `);
    const event = pressEnter(form.querySelector("input")!);

    expect(submits()).toBe(0);
    expect(clicks()).toEqual([0]);
    // Also cancels the browser's own implicit submission, which would ignore the disabled button
    expect(event.defaultPrevented).toBe(true);
  });

  it("follows the disabled state", async () => {
    const { form, buttons: [button], submits } = await setup(`
      <form>
        <input name="email" type="email" />
        <tp-button type="submit" disabled>Send</tp-button>
      </form>
    `);
    const input = form.querySelector("input")!;

    pressEnter(input);
    button.disabled = false;
    await button.updateComplete;
    pressEnter(input);

    expect(submits()).toBe(1);
  });

  it("leaves Enter in a textarea alone", async () => {
    const { form, submits } = await setup(`
      <form>
        <textarea name="bio"></textarea>
        <tp-button type="submit">Send</tp-button>
      </form>
    `);
    const event = pressEnter(form.querySelector("textarea")!);

    expect(submits()).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(["checkbox", "radio", "range", "color", "file"])("leaves Enter in an input of type %s alone", async type => {
    const { form, submits } = await setup(`
      <form>
        <input name="field" type="${type}" />
        <tp-button type="submit">Send</tp-button>
      </form>
    `);
    const event = pressEnter(form.querySelector("input")!);

    expect(submits()).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves Enter alone during IME composition", async () => {
    const { form, submits } = await setup(`
      <form>
        <input name="name" />
        <tp-button type="submit">Send</tp-button>
      </form>
    `);
    const event = pressEnter(form.querySelector("input")!, { isComposing: true });

    expect(submits()).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves Enter alone after another handler called preventDefault()", async () => {
    const { form, submits } = await setup(`
      <form>
        <input name="name" />
        <tp-button type="submit">Send</tp-button>
      </form>
    `);
    const input = form.querySelector("input")!;
    input.addEventListener("keydown", event => event.preventDefault());

    pressEnter(input);

    expect(submits()).toBe(0);
  });

  it("only lets the first of two <tp-button type=submit> act", async () => {
    const { form, submits, clicks } = await setup(`
      <form>
        <input name="name" />
        <tp-button type="submit">First</tp-button>
        <tp-button type="submit">Second</tp-button>
      </form>
    `);

    pressEnter(form.querySelector("input")!);

    expect(submits()).toBe(1);
    expect(clicks()).toEqual([1, 0]);
  });

  it("skips a <tp-button> that is not a submit button when looking for the default button", async () => {
    const { form, clicks } = await setup(`
      <form>
        <input name="name" />
        <tp-button>Cancel</tp-button>
        <tp-button type="submit">Send</tp-button>
      </form>
    `);

    pressEnter(form.querySelector("input")!);

    expect(clicks()).toEqual([0, 1]);
  });

  it("leaves a form whose first submit button is native to the browser", async () => {
    const { form, submits, clicks } = await setup(`
      <form>
        <input name="name" />
        <button type="submit">Native</button>
        <tp-button type="submit">Custom</tp-button>
      </form>
    `);
    const event = pressEnter(form.querySelector("input")!);

    expect(submits()).toBe(0);
    expect(clicks()).toEqual([0]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("treats a native <button> without a type as a submit button", async () => {
    const { form, clicks } = await setup(`
      <form>
        <input name="name" />
        <button>Native</button>
        <tp-button type="submit">Custom</tp-button>
      </form>
    `);

    pressEnter(form.querySelector("input")!);

    expect(clicks()).toEqual([0]);
  });

  it("keeps the button's own Enter activation (one submission)", async () => {
    const { buttons: [button], submits } = await setup(`
      <form>
        <input name="name" />
        <tp-button type="submit">Send</tp-button>
      </form>
    `);

    pressEnter(button);

    expect(submits()).toBe(1);
  });

  it("stops when the type changes away from submit and resumes when it changes back", async () => {
    const { form, buttons: [button], submits } = await setup(`
      <form>
        <input name="name" />
        <tp-button type="submit">Send</tp-button>
      </form>
    `);
    const input = form.querySelector("input")!;

    button.type = "button";
    await button.updateComplete;

    const ignored = pressEnter(input);

    button.type = "submit";
    await button.updateComplete;
    pressEnter(input);

    expect(ignored.defaultPrevented).toBe(false);
    expect(submits()).toBe(1);
  });

  it("stops when the button is disconnected", async () => {
    const { form, buttons: [button], clicks } = await setup(`
      <form>
        <input name="a" />
        <input name="b" />
        <tp-button type="submit">Send</tp-button>
      </form>
    `);

    button.remove();
    await button.updateComplete;

    const event = pressEnter(form.querySelector("input")!);

    expect(clicks()).toEqual([0]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("follows the button when it moves to another form", async () => {
    const { form, buttons: [button] } = await setup(`
      <form id="first">
        <input name="a" />
        <tp-button type="submit">Send</tp-button>
      </form>
      <form id="second">
        <input name="b" />
      </form>
    `);
    const second = document.querySelector<HTMLFormElement>("#second")!;
    let secondSubmits = 0;
    second.addEventListener("submit", event => {
      event.preventDefault();
      secondSubmits++;
    });

    second.append(button);
    await button.updateComplete;

    const inFirst = pressEnter(form.querySelector("input")!);
    pressEnter(second.querySelector("input")!);

    expect(inFirst.defaultPrevented).toBe(false);
    expect(secondSubmits).toBe(1);
  });

  it("follows a form owner set through the form attribute", async () => {
    const { buttons: [button] } = await setup(`
      <form id="first">
        <input name="a" />
        <tp-button type="submit">Send</tp-button>
      </form>
      <form id="second">
        <input name="b" />
      </form>
    `);
    const second = document.querySelector<HTMLFormElement>("#second")!;
    let secondSubmits = 0;
    second.addEventListener("submit", event => {
      event.preventDefault();
      secondSubmits++;
    });

    button.setAttribute("form", "second");
    await button.updateComplete;
    pressEnter(second.querySelector("input")!);

    expect(button.form).toBe(second);
    expect(secondSubmits).toBe(1);
  });

  it("ignores Enter in a field that belongs to another form", async () => {
    const { form, submits } = await setup(`
      <form id="own">
        <input name="other" form="elsewhere" />
        <tp-button type="submit">Send</tp-button>
      </form>
      <form id="elsewhere"></form>
    `);
    const event = pressEnter(form.querySelector("input")!);

    expect(submits()).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});
