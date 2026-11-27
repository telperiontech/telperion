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

### Construct Fetcher

A utility function that creates a proxy wrapper around Angular's `HttpClient` to convert Observable-based HTTP methods into Promise-based methods with automatic error handling. Returns a tuple of `[error, response]` instead of throwing, following the Go-style error handling pattern.

#### Features

- 🎯 Converts all HttpClient methods to Promise-based API
- ✅ Returns `[error, response]` tuple for predictable error handling
- 🔍 The tuple is a discriminated union: `if (error) return;` narrows the response to `T`
- 🔄 Automatically uses `firstValueFrom` to convert Observables
- 🛡️ No try-catch blocks needed in your code
- 💉 Uses Angular's dependency injection

#### Usage

**Basic example:**

```typescript
import { Component } from '@angular/core';
import { constructFetcher } from '@telperion/ng-pack/utils';

@Component({
  selector: 'app-example',
  template: `
    <button (click)="fetchData()">Fetch Data</button>
    <div *ngIf="loading">Loading...</div>
    <div *ngIf="error">Error: {{ error }}</div>
    <div *ngIf="data">{{ data | json }}</div>
  `
})
export class ExampleComponent {
  private fetcher = constructFetcher();
  
  loading = false;
  error: any = null;
  data: any = null;

  async fetchData() {
    this.loading = true;
    const [error, response] = await this.fetcher.get<{ items: string[] }>('/api/data');
    this.loading = false;
    
    if (error) {
      this.error = error;
      console.error('Error fetching data:', error);
      return;
    }
    
    this.data = response;
    console.log('Fetched data:', response);
  }
}
```

**POST request with body:**

```typescript
async createUser() {
  const [error, response] = await this.fetcher.post<User>(
    '/api/users',
    { name: 'John', email: 'john@example.com' }
  );
  
  if (error) {
    console.error('Failed to create user:', error);
    return;
  }
  
  console.log('User created:', response);
}
```

**With request options:**

```typescript
async fetchWithHeaders() {
  const [error, response] = await this.fetcher.get<Data>(
    '/api/data',
    {
      headers: { 'Authorization': 'Bearer token' },
      params: { page: '1', limit: '10' }
    }
  );
  
  if (error) {
    // Handle error
    return;
  }
  
  // Use response
}
```

#### API

The fetcher provides the same methods as `HttpClient` but with Promise-based signatures. `E` defaults to `FetcherError` (`HttpErrorResponse | Error`):

- `get<T, E>(url, options?)` → `Promise<[E, null] | [null, T]>`
- `post<T, E>(url, body, options?)` → `Promise<[E, null] | [null, T]>`
- `put<T, E>(url, body, options?)` → `Promise<[E, null] | [null, T]>`
- `patch<T, E>(url, body, options?)` → `Promise<[E, null] | [null, T]>`
- `delete<T, E>(url, options?)` → `Promise<[E, null] | [null, T]>`
- `head<T, E>(url, options?)` → `Promise<[E, null] | [null, T]>`
- `options<T, E>(url, options?)` → `Promise<[E, null] | [null, T]>`
- `request<T, E>(method, url, options?)` → `Promise<[E, null] | [null, T]>`

- `withRetry<E>(options)` → a `Fetcher` with the same methods, whose calls retry failed requests (see [Retrying requests](#retrying-requests))

The `Fetcher`, `FetcherError`, `FetcherMethods` and `FetcherRetryOptions` types are exported from `@telperion/ng-pack/utils`. The tuple type is `TryCatchResult` from `@telperion/js-utils/promise` (`@telperion/js-utils` 4.0.0 or later).

#### Return Value

All methods return a Promise that resolves to a tuple:
- **Success**: `[null, response]` - Error is null, response contains the data
- **Failure**: `[error, null]` - Error contains the error object, response is null. The error is never `null` or `undefined`.

Because the tuple is a discriminated union, checking the error narrows the response:

```typescript
const [error, user] = await this.fetcher.get<User>('/api/me');

if (error) {
  return; // error: HttpErrorResponse | Error
}

user.name; // user: User
```

If an interceptor can throw something other than an `Error`, pass `unknown` as the error type and check against `null` (an `unknown` error could be falsy, so `if (error)` doesn't narrow it):

```typescript
const [error, user] = await this.fetcher.get<User, unknown>('/api/me');

if (error !== null) {
  return;
}

user.name; // user: User
```

#### Retrying requests

`fetcher.withRetry(options)` returns a fetcher whose calls retry failed requests with js-utils [`retry`](https://open-source.telperion.tr/js-utils/promise/retry), sending the request again on each attempt. Calls still never reject: they resolve with the response of the first successful attempt, or with the last error once `when` returns `false` or the retries are used up.

```typescript
import { HttpErrorResponse } from '@angular/common/http';
import { constructFetcher, type FetcherError } from '@telperion/ng-pack/utils';
import { seconds } from '@telperion/js-utils/time';

export class SessionService {
  static readonly #offline = (error: FetcherError) => error instanceof HttpErrorResponse && error.status === 0;

  readonly #fetcher = constructFetcher();

  async refresh() {
    // Retry only network failures (status 0), waiting 2 s, 4 s and 8 s; a 401 resolves at once
    const [error, session] = await this.#fetcher
      .withRetry({ count: 3, delay: attempt => seconds(2 ** attempt), when: SessionService.#offline })
      .post<Session>('/auth/refresh', null, { withCredentials: true });
  }
}
```

Options (as in js-utils `RetryOptions`):
- `count`: retries after the first attempt (default `3`)
- `delay`: milliseconds before each retry, or a function of the retry number (`1`, `2`, …) and the error (default `0`)
- `when`: retry only when it returns `true`; receives the error and the retry number (default: always)

`delay` and `when` receive the error typed as `FetcherError`. A `when` that takes `unknown` works as well and does not change the error type of the results. To use another error type, pass it: `fetcher.withRetry<HttpErrorResponse>({ when: error => error.status === 0 })` (the type is not checked at runtime).

`withRetry` leaves the fetcher it is called on unchanged, and calling it on a retrying fetcher replaces the options instead of adding to them. Keep the result in a field to reuse it:

```typescript
readonly #retrying = constructFetcher().withRetry({ count: 2, delay: 500 });
```

#### Benefits

1. **No try-catch needed**: Error handling is explicit and predictable
2. **Type-safe**: Full TypeScript support with generic types
3. **Consistent pattern**: Same error handling pattern across all HTTP methods
4. **DI integration**: Works seamlessly with Angular's dependency injection
5. **Clean code**: Reduces boilerplate and improves readability

### toSignal

A unified helper that converts a plain value, a Promise, or an Observable into an Angular `Signal`. It normalises the input through `@angular/core/rxjs-interop`'s `toSignal`, so you can use a single call regardless of the source type.

#### Usage

```typescript
import { toSignal } from '@telperion/ng-pack/utils';

// From a plain value
const count = toSignal(42);

// From a Promise
const user = toSignal(fetch('/api/me').then(r => r.json()));

// From an Observable
const messages = toSignal(this.messageService.messages$);

// With options (forwarded to Angular's toSignal)
const data = toSignal(this.dataService.data$, { initialValue: [] });
```

#### API

`toSignal<T>(source: T | Promise<T> | Observable<T>, options?): Signal<T | undefined>`

- `source` - A plain value, Promise, or Observable
- `options` (optional) - Configuration forwarded to Angular's `toSignal` (e.g., `{ initialValue }` )
- Returns a read-only `Signal<T | undefined>`

## License

MIT
