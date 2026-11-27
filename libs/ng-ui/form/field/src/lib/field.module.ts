import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ValidSubmitDirective } from "@telperion/ng-pack/forms";

import { CheckFieldComponent } from "./check-field.component";
import { FieldComponent } from "./field.component";
import { NATIVE_FOCUS_WATCHERS } from "./focus-watchers";

const DIRECTIVES = [
  FormsModule,
  ValidSubmitDirective,
  ...NATIVE_FOCUS_WATCHERS,
  FieldComponent,
  CheckFieldComponent
];

@NgModule({
  imports: [
    ...DIRECTIVES
  ],
  exports: [
    ...DIRECTIVES
  ],
})
export class FieldModule { }
