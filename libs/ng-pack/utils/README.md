# @telperion/ng-pack/utils

Angular utility functions and plugins for enhanced development experience

## Motivation

Provide reusable utilities and plugins for Angular applications to reduce boilerplate and enhance developer productivity.

## Goals

* TypeScript support
* Tree-shaking
* Minimal dependencies
* Type-safe
* Well documented
* High test coverage

## Installation

```bash
npm install @telperion/ng-pack
# or
yarn add @telperion/ng-pack
# or
pnpm add @telperion/ng-pack
```

## Features

### Event Modifiers Plugin

Angular Event Manager Plugin that enables event modifier syntax in templates, similar to Vue.js.

#### Usage

First, provide the plugin in your application:

```typescript
import { provideEventModifiersPlugin } from '@telperion/ng-pack/utils';

bootstrapApplication(AppComponent, {
  providers: [provideEventModifiersPlugin()]
});
```

Then use modifiers in your templates:

```html
<!-- Prevent default form submission -->
<form (submit.pd)="onSubmit()">...</form>

<!-- Stop event propagation -->
<div (click.sp)="handleClick()">...</div>

<!-- Chain multiple modifiers -->
<button (click.pd.sp)="handleButtonClick()">Click me</button>
```

#### Available Modifiers

- `pd` - Calls `preventDefault()` on the event
- `sp` - Calls `stopPropagation()` on the event

### Provide Service Directive

Utility function to create a provider for a directive/component that can be injected as a service. Useful for parent-child directive communication.

#### Usage

**1. Create an injection token:**

```typescript
// parent.service.ts
import { InjectionToken } from "@angular/core";
import type { ParentDirective } from "./parent.directive";

export const ParentService = new InjectionToken<ParentDirective>("ParentService");
```

**2. Provide the directive as a service:**

```typescript
// parent.directive.ts
import { Directive } from "@angular/core";
import { provideServiceDirective } from "@telperion/ng-pack/utils";
import { ParentService } from "./parent.service";

@Directive({
  selector: '[parent]',
  providers: [provideServiceDirective(ParentService, ParentDirective)],
})
export class ParentDirective {
  doSomething() {
    console.log('Parent action');
  }
}
```

**3. Inject in child directive:**

```typescript
// child.directive.ts
import { Directive, inject } from "@angular/core";
import { ParentService } from "./parent.service";

@Directive({
  selector: '[child]',
})
export class ChildDirective {
  private parent = inject(ParentService);

  ngOnInit() {
    this.parent.doSomething();
  }
}
```

**4. Use in template:**

```html
<div parent>
  <div child></div>
</div>
```

## License

MIT
