import { Component } from "@angular/core";
import { provideServiceDirective } from "@telperion/ng-pack/utils";

import { BaseFieldComponent } from "./base-field.component";
import { FieldService } from "./field.service";
import { FieldInfoComponent } from "./info.component";

/**
 * Labelled field wrapper for a single control (`ngModel`, or `tui-field-input` without one).
 *
 * The wrapper draws the border and focus ring, so it strips the projected control's own border and
 * outline and gives it the padding (`px-3 py-2`). Those control styles sit in `:where()`, which has
 * no specificity: a utility class on the control itself (e.g. `class="px-1"`) overrides them.
 */
@Component({
  selector: "tui-field",
  imports: [FieldInfoComponent],
  providers: [provideServiceDirective(FieldService, FieldComponent)],
  template: `
    <fieldset class="flex flex-col gap-1">
      <legend class="text-sm font-medium mb-1">
        {{ label() }}
        @if (isRequired()) {
          <span class="text-secondary">*</span>
        }
      </legend>
      <div field-input class="
        flex bg-white rounded-md border border-neutral outline outline-transparent transition
        group-[.focused]:outline-secondary group-[.focused]:border-secondary
        group-[.invalid]:border-danger group-[.invalid]:text-danger group-[.invalid.focused]:outline-danger
        [:where(&>[class*='ng-'],&>[tui-field-input])]:border-none [:where(&>[class*='ng-'],&>[tui-field-input])]:outline-none
        [:where(&>[class*='ng-'],&>[tui-field-input])]:w-full [:where(&>[class*='ng-'],&>[tui-field-input])]:flex-1
        [:where(&>[class*='ng-'],&>[tui-field-input])]:px-3 [:where(&>[class*='ng-'],&>[tui-field-input])]:py-2
        ">
        <ng-content></ng-content>
      </div>
    </fieldset>
    <tui-field-info></tui-field-info>
  `,
  host: {
    "class": "block group",
    "[class.invalid]": "showErrors()",
    "[class.focused]": "hasFocus()"
  }
})
export class FieldComponent extends BaseFieldComponent { }
