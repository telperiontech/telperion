# @telperion/ng-pack/forms

Helpers that keep template-driven form logic in the template.

## Features

- ✅ **`(tngValidSubmit)`** — emits the form's value only on a valid submit; templates stop repeating `form.valid && submits.next(form.value)`, and forgetting the check can no longer send invalid values
- 👆 **Invalid submits reveal errors** — every control is marked as touched, so fields show their errors even when nothing was edited, and the first invalid control is focused
- 🧾 **`[tngValidSubmitShape]`** — types the emitted value instead of `NgForm.value`'s `any`, and checks it at runtime against the registered controls
- 🌊 **Stream-based** — the output is `outputFromObservable` over `NgForm.ngSubmit`; nothing calls `emit()`

## Installation

This is a secondary entry point of `@telperion/ng-pack`. Import from `@telperion/ng-pack/forms`.

```bash
npm install @telperion/ng-pack
```

`@telperion/ng-ui`'s `FieldModule` re-exports `ValidSubmitDirective`, so components that use `<tui-field>` get it with the same import.

## `ValidSubmitDirective`

Selector: `form[tngValidSubmit]` (it needs `NgForm` on the same `<form>`, i.e. `FormsModule`). Exported as `tngValidSubmit`.

```typescript
import { Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ValidSubmitDirective } from '@telperion/ng-pack/forms';
import { exhaustMap, Subject } from 'rxjs';

@Component({
  imports: [FormsModule, ValidSubmitDirective],
  template: `
    <form #form="ngForm" (tngValidSubmit)="submits.next($event)" [tngValidSubmitShape]="{ email: 'string', password: 'string' }">
      <input type="email" name="email" ngModel autocomplete="username" required email />
      <input type="password" name="password" ngModel autocomplete="current-password" required />
      <button type="submit" [disabled]="busy()">Sign in</button>
    </form>
  `,
})
export class LoginPage {
  /** The form's value on each valid submit; the template owns the fields. */
  protected readonly submits = new Subject<LoginRequest>();
  protected readonly submission = toSignal(this.submits.pipe(exhaustMap(request => this.#auth.login(request))), { initialValue: { status: 'idle' } });
  protected readonly busy = computed(() => this.submission().status === 'pending');
}
```

### What happens on submit

| Form status at submit | Result |
| --- | --- |
| `VALID` | `tngValidSubmit` emits `NgForm.value` once (after the shape check below) |
| `INVALID` | Nothing is emitted. Every control is marked as touched and the first invalid, focusable control (in document order) is focused |
| `PENDING` (async validators running) | Nothing happens |

The first invalid control is found through the `ng-invalid` class Angular puts on each `ngModel` element: the first `input`, `select`, `textarea` or element with a `tabindex` that has it.

### Typing the value: `tngValidSubmitShape`

`NgForm.value` is `any`. Bind `tngValidSubmitShape` to an object that lists the form's controls by `name` and the type of each value:

| Entry | Value |
| --- | --- |
| `'string'`, `'number'`, `'boolean'` | a value of that `typeof` |
| `'string \| null'`, `'number \| null'`, `'boolean \| null'` | the same, or `null` (e.g. a cleared `<input type="number">`) |
| `'unknown'` | anything (arrays, dates, custom control values), typed `unknown` |
| a nested object | an `ngModelGroup` with these controls |

```html
<form (tngValidSubmit)="submits.next($event)"
      [tngValidSubmitShape]="{ age: 'number | null', address: { city: 'string', zip: 'string' } }">
```

What this gives you:

- **Checked at compile time** (with `strictTemplates`): the emitted value's type comes from the shape literal in the template, e.g. `{ email: string; password: string }`. Handing it to a `Subject<LoginRequest>` that expects other names or types, or a misspelt entry such as `'text'`, is a template type error. Without a shape the value is typed `{ [name: string]: unknown }`, which a `Subject<LoginRequest>` does not accept, so no `any` reaches the class.
- **Checked at runtime**, on every valid submit: the value must have exactly the shape's names (a missing or an extra control is a mismatch, also inside groups), and every value must have the stated type. On a mismatch nothing is emitted and an error naming the control is reported to Angular's `ErrorHandler`.
- **Not checked at compile time**: Angular's type checker does not know the `name` attributes, so a control named differently from the shape is only caught by the runtime check, on the first valid submit.

Two things that show up in the runtime check:

- A plain `ngModel` attribute starts its control at `''` until the user edits it. Give controls whose value is not a string a start value in the template, e.g. `[ngModel]="false"` on a checkbox (`'boolean'`) or `[ngModel]="null"` on a number input (`'number | null'`).
- Disabled controls are left out of `NgForm.value`, so they are reported as missing. Leave them out of the shape, or don't disable controls that the shape lists.

### Inputs and outputs

| Name | Type | Description |
| --- | --- | --- |
| `(tngValidSubmit)` | `ValidSubmitValue<S>` | The form's value on each valid submit |
| `[tngValidSubmitShape]` | `S extends ValidSubmitShape` | The expected controls; types the output and is checked at runtime |

Exported types: `ValidSubmitShape`, `ValidSubmitShapeEntry`, `ValidSubmitPrimitive`, `ValidSubmitValue<S>`, `ValidSubmitEntryValue<E>`.
