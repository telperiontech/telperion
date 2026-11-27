import type { ReactiveController, ReactiveControllerHost } from "lit";

/** What {@link ImplicitSubmissionController} needs from the button it is attached to. */
export interface ImplicitSubmissionHost extends ReactiveControllerHost, HTMLElement {
  readonly type: string;
  readonly disabled: boolean;
  readonly form: HTMLFormElement | null;
}

/**
 * Gives a custom submit button the HTML spec's
 * [implicit submission](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission):
 * pressing `Enter` in a text field of the form activates the form's default button.
 *
 * Browsers only treat native `<button>` / `<input type="submit|image">` elements as a form's
 * default button. Without this controller, a form whose only submit control is a custom element
 * either submits without asking the button (one text field, even when the button is disabled)
 * or ignores `Enter` (two or more text fields).
 *
 * The controller listens for `keydown` on the host's form owner while the host is connected and
 * its `type` is `submit`, and moves the listener when the form owner or the type changes.
 * On `Enter` in one of the form's text fields it acts only when the host is the form's default
 * button (the first submit button in tree order, native or custom):
 *
 * - it cancels the key's default action, so the browser does not run its own implicit submission;
 * - it clicks the host unless the host is disabled, in which case nothing is submitted.
 *
 * It leaves the key alone during IME composition, when another handler has already called
 * `preventDefault()`, for targets other than text fields (`<textarea>`, checkboxes, the button
 * itself, …) and for forms whose default button is a native one.
 *
 * The host must call `requestUpdate()` from `formAssociatedCallback` so a new form owner is picked up.
 */
export class ImplicitSubmissionController implements ReactiveController {
  /**
   * The input types the spec calls "fields that block implicit submission": the ones where `Enter`
   * submits the form. Chrome and Firefox submit for the same types.
   */
  static readonly #TEXT_FIELD_TYPES: ReadonlySet<string> = new Set([
    "text", "search", "url", "tel", "email", "password",
    "date", "month", "week", "time", "datetime-local", "number",
  ]);

  /** Whether the key event asks for implicit submission from a text field of `form`. */
  static #isImplicitSubmission(event: KeyboardEvent, form: HTMLFormElement): boolean {
    const field = event.target;

    return event.key === "Enter"
      && !event.isComposing
      // Safari reports the key that ends an IME composition as keyCode 229 without isComposing
      && event.keyCode !== 229
      && !event.defaultPrevented
      && field instanceof HTMLInputElement
      && field.form === form
      && ImplicitSubmissionController.#TEXT_FIELD_TYPES.has(field.type);
  }

  /** Whether a listed element of a form is a submit button that can be its default button. */
  static #isSubmitButton(element: Element, customButton: CustomElementConstructor): boolean {
    if (element instanceof HTMLButtonElement) return element.type === "submit";

    if (element instanceof HTMLInputElement) return element.type === "submit" || element.type === "image";

    return element instanceof customButton && (element as unknown as ImplicitSubmissionHost).type === "submit";
  }

  readonly #host: ImplicitSubmissionHost;

  /** The form currently listened to, with the controller that removes the listener. */
  #listening: { readonly form: HTMLFormElement; readonly stop: AbortController } | null = null;

  constructor(host: ImplicitSubmissionHost) {
    this.#host = host;
    host.addController(this);
  }

  /** The form this button should listen to right now: its form owner while it is a connected submit button. */
  get #wantedForm(): HTMLFormElement | null {
    return this.#host.isConnected && this.#host.type === "submit" ? this.#host.form : null;
  }

  hostConnected(): void {
    this.#listenTo(this.#wantedForm);
  }

  hostUpdated(): void {
    this.#listenTo(this.#wantedForm);
  }

  hostDisconnected(): void {
    this.#listenTo(null);
  }

  /** Moves the keydown listener to `form` (or removes it for `null`); does nothing if it is already there. */
  #listenTo(form: HTMLFormElement | null): void {
    if (this.#listening?.form === form) return;

    this.#listening?.stop.abort();
    this.#listening = form && { form, stop: new AbortController() };
    form?.addEventListener("keydown", this.#onKeydown, { signal: this.#listening!.stop.signal });
  }

  #onKeydown = (event: KeyboardEvent): void => {
    const form = event.currentTarget as HTMLFormElement;

    if (!ImplicitSubmissionController.#isImplicitSubmission(event, form)) return;

    const customButton = this.#host.constructor as CustomElementConstructor;
    const defaultButton = Array.from(form.elements).find(element => ImplicitSubmissionController.#isSubmitButton(element, customButton));

    if (defaultButton !== this.#host) return;

    event.preventDefault();

    if (!this.#host.disabled) {
      this.#host.click();
    }
  };
}
