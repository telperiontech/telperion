# @telperion/ng-ui/form/field

`FieldComponent` (selector `tui-field`) and `FieldModule`.

```ts
import { FieldModule } from '@telperion/ng-ui/form/field';
```

`FieldComponent` is **not** standalone — import `FieldModule` to declare it.

## Projected inputs

The field styles its direct child control (no border/outline, full width) when
that child either:

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

`tui-field-input` is a plain styling hook, not a directive. Without `ngModel`
the field still shows the label, hint and focus ring, but it cannot read
validation state, so error messages, the invalid style and the required `*`
marker are not shown.
