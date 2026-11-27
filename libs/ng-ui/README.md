# @telperion/ng-ui

Angular UI element library organized as ng-packagr secondary entry points.

## Installation

```bash
pnpm add @telperion/ng-ui @telperion/ng-pack
```

`@telperion/ng-pack` (^4.2.0) is a peer dependency, so the app and `ng-ui` share one copy of
its injection tokens and directives. npm 7+ and pnpm install it automatically when it is missing.

## Entry points

| Subpath                         | Exports                                  |
| ------------------------------- | ---------------------------------------- |
| `@telperion/ng-ui`              | Library version constant                 |
| `@telperion/ng-ui/form`         | (placeholder for future form-level APIs) |
| `@telperion/ng-ui/form/field`   | `FieldComponent`, `FieldModule` (also exports `FormsModule` and `ValidSubmitDirective` from `@telperion/ng-pack/forms`) |

## Usage

```ts
import { NgModule } from '@angular/core';
import { FieldModule } from '@telperion/ng-ui/form/field';

@NgModule({
  imports: [FieldModule],
})
export class AppModule {}
```

```html
<tui-field label="Email">
  <input type="email" name="email" ngModel required email />
</tui-field>

<!-- Inputs without ngModel opt in to field styling with tui-field-input -->
<tui-field label="Search">
  <input tui-field-input type="search" />
</tui-field>
```

`FieldComponent` is **not** standalone and must be used through `FieldModule`.

### Forms

`FieldModule` also exports `FormsModule` and `ValidSubmitDirective` (`@telperion/ng-pack/forms`), so one
import covers a whole template-driven form. `(tngValidSubmit)` emits the form's value only on a valid
submit; on an invalid submit it marks every control as touched, so each `<tui-field>` shows its error,
and focuses the first invalid control:

```html
<form (tngValidSubmit)="submits.next($event)" [tngValidSubmitShape]="{ email: 'string', password: 'string' }">
  <tui-field label="Email">
    <input type="email" name="email" ngModel autocomplete="username" required email />
  </tui-field>
  <tui-field label="Password">
    <input type="password" name="password" ngModel autocomplete="current-password" required />
  </tui-field>
  <tp-button type="submit" color="primary">Sign in</tp-button>
</form>
```

A field shows its error once its control is invalid and was edited or touched (left after focusing,
or marked as touched by an invalid submit). See [`@telperion/ng-pack/forms`](https://github.com/telperiontech/telperion/tree/main/libs/ng-pack/forms) for the typing of the emitted value.

## Tailwind v4

Components ship pre-compiled with utility classes baked into their templates as
plain strings. To make those utilities visible in your app, your application
must run Tailwind v4 and tell it to scan this package:

```css
/* your-app/styles.css */
@import "tailwindcss";
@source "../node_modules/@telperion/ng-ui/**/*.{mjs,js}";
```

## Development

```bash
pnpm nx run ng-ui:storybook        # http://localhost:10563
pnpm nx run ng-ui:build
pnpm nx run ng-ui:test           # TestBed specs (jsdom)
pnpm nx run ng-ui:build-storybook
pnpm nx run ng-ui:lint
```

See also: [./form/README.md](./form/README.md), [./form/field/README.md](./form/field/README.md).
