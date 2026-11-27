import { Directive, ElementRef, ErrorHandler, inject, input } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgForm } from '@angular/forms';
import { filter, map, share } from 'rxjs';

import type { ValidSubmitShape, ValidSubmitShapeEntry, ValidSubmitValue } from './valid-submit-shape';

/**
 * Emits a template-driven form's value on each **valid** submit, so the template does not repeat
 * `form.valid && submits.next(form.value)` and an invalid form cannot slip through.
 *
 * Put it on a `<form>` that has `NgForm` (any `<form>` in a component that imports `FormsModule`):
 *
 * ```html
 * <form (tngValidSubmit)="submits.next($event)" [tngValidSubmitShape]="{ email: 'string', password: 'string' }">
 *   <input type="email" name="email" ngModel required email />
 *   <input type="password" name="password" ngModel required />
 *   <button type="submit">Sign in</button>
 * </form>
 * ```
 *
 * On each submit (`NgForm.ngSubmit`):
 *
 * - **valid** form: `tngValidSubmit` emits `NgForm.value`, once;
 * - **invalid** form: nothing is emitted; every control is marked as touched, so fields show their
 *   errors even when nothing was edited, and the first invalid control (in document order) is focused;
 * - **pending** form (async validators still running): nothing happens.
 *
 * ### Typing
 *
 * `NgForm.value` is `any`. Bind `tngValidSubmitShape` to describe the controls; the emitted value
 * is then typed from it (`{ email: string; password: string }` above), so handing it to a
 * `Subject<LoginRequest>` is checked by the template type checker. The shape is also checked at
 * runtime on every valid submit: the value must have exactly the shape's control names, with values
 * of the stated types. On a mismatch nothing is emitted and the mismatch is reported to Angular's
 * `ErrorHandler`. Without a shape the value is typed `{ [name: string]: unknown }`.
 *
 * Nothing ties the `name` attributes in the template to the shape at compile time: a misspelt name
 * is reported by the runtime check on the first valid submit.
 *
 * @see ValidSubmitShape
 */
@Directive({
  selector: 'form[tngValidSubmit]',
  exportAs: 'tngValidSubmit',
})
export class ValidSubmitDirective<S extends ValidSubmitShape = ValidSubmitShape> {
  /** Focusable elements Angular marks invalid (`NgControlStatus` adds `ng-invalid` to each control). */
  private static readonly INVALID_CONTROL = ':is(input, select, textarea, [tabindex]).ng-invalid';

  /** Describes the first way `value` does not match `shape`, or returns `null` when it matches. */
  private static mismatch(value: unknown, shape: ValidSubmitShape, path = ''): string | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return `${path ? `"${path}"` : 'the form value'} is ${ValidSubmitDirective.describe(value)}, not a group of controls`;
    }

    const group = value as Record<string, unknown>;

    return Object.keys({ ...shape, ...group })
      .map(name => ValidSubmitDirective.controlMismatch(group, name, shape[name], path ? `${path}.${name}` : name))
      .find(mismatch => mismatch !== null) ?? null;
  }

  private static controlMismatch(group: Record<string, unknown>, name: string, entry: ValidSubmitShapeEntry | undefined, path: string): string | null {
    if (entry === undefined) return `"${path}" is not in the shape`;

    if (!(name in group)) return `"${path}" is missing (disabled controls are left out of the form value)`;

    const value = group[name];

    if (typeof entry === 'object') return ValidSubmitDirective.mismatch(value, entry, path);

    if (entry === 'unknown') return null;

    if (value === null && entry.endsWith(' | null')) return null;

    return typeof value === entry.replace(' | null', '') ? null : `"${path}" is ${ValidSubmitDirective.describe(value)}, not ${entry}`;
  }

  private static describe(value: unknown): string {
    if (value === null) return 'null';

    if (Array.isArray(value)) return 'an array';

    return typeof value === 'object' ? 'an object' : `${typeof value} ${JSON.stringify(value)}`;
  }

  readonly #form = inject(NgForm, { self: true });
  readonly #element = inject<ElementRef<HTMLFormElement>>(ElementRef).nativeElement;
  readonly #errorHandler = inject(ErrorHandler);

  /**
   * The controls the form is expected to hold and the type of each value. Types the emitted value
   * and is checked against it at runtime; see {@link ValidSubmitShape}.
   */
  readonly tngValidSubmitShape = input<S>();

  /** The form's status at each submit. */
  readonly #submits = this.#form.ngSubmit.pipe(map(() => this.#form.status), share());

  /** The form's value on each valid submit that matches the shape. */
  readonly #validValues = this.#submits.pipe(
    filter(status => status === 'VALID'),
    map((): unknown => this.#form.value),
    filter((value): value is ValidSubmitValue<S> => this.#matchesShape(value)),
  );

  /** Emits the form's value on each valid submit. */
  readonly validSubmit = outputFromObservable(this.#validValues, { alias: 'tngValidSubmit' });

  constructor() {
    this.#submits.pipe(
      filter(status => status === 'INVALID'),
      takeUntilDestroyed(),
    ).subscribe(() => this.#revealErrors());
  }

  /** Whether the value matches the shape (always, without one); reports a mismatch to the `ErrorHandler`. */
  #matchesShape(value: unknown): boolean {
    const shape = this.tngValidSubmitShape();
    const mismatch = shape ? ValidSubmitDirective.mismatch(value, shape) : null;

    if (mismatch) {
      this.#errorHandler.handleError(new Error(`tngValidSubmit: the form value does not match tngValidSubmitShape: ${mismatch}`));
    }

    return mismatch === null;
  }

  /** Marks every control as touched, so fields show their errors, and focuses the first invalid one. */
  #revealErrors(): void {
    this.#form.form.markAllAsTouched();
    this.#element.querySelector<HTMLElement>(ValidSubmitDirective.INVALID_CONTROL)?.focus();
  }
}
