# @telperion/ng-ui/form/field

`FieldComponent` (selector `tui-field`) and `FieldModule`.

```ts
import { FieldModule } from '@telperion/ng-ui/form/field';
```

`FieldComponent` is **not** standalone — import `FieldModule` to declare it.

## Projected inputs

The field styles its direct child control (no border/outline, full width,
`px-3 py-2` padding) when that child either:

- is bound with `ngModel` — matched through Angular's `ng-*` state classes, or
- carries the `tui-field-input` attribute — for controls without `ngModel`.

```html
<!-- With ngModel: styling, validation, errors and the required marker -->
<tui-field label="Email">
  <input type="email" name="email" ngModel required email />
</tui-field>

<!-- Without ngModel: opt in to styling with tui-field-input -->
<tui-field label="Search">
  <input tui-field-input type="search" [value]="query" (input)="query = $any($event.target).value" />
</tui-field>
```

These control styles have no specificity (they sit in `:where()`), so a
utility class on the control overrides them without `!important`:

```html
<tui-field label="Amount">
  <input type="number" name="amount" ngModel class="px-1 text-right" />
</tui-field>
```

`tui-check-field` does not style its control: checkboxes and radios keep their
native size, and the label text next to them needs no padding.

`tui-field-input` is a plain styling hook, not a directive. Without `ngModel`
the field still shows the label, hint and focus ring, but it cannot read
validation state, so error messages, the invalid style and the required `*`
marker are not shown.
