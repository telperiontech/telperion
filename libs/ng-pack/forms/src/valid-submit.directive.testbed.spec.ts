import { Component, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule, NgForm } from '@angular/forms';
import { Observable, Subject } from 'rxjs';

import { ValidSubmitDirective } from './valid-submit.directive';

interface LoginRequest {
  email: string;
  password: string;
}

@Component({
  imports: [FormsModule, ValidSubmitDirective],
  template: `
    <form #form="ngForm" (tngValidSubmit)="submits.next($event)" [tngValidSubmitShape]="{ email: 'string', password: 'string' }">
      <input type="email" name="email" ngModel required email />
      <input type="password" name="password" ngModel required />
      <button type="submit">Sign in</button>
    </form>
  `,
})
class LoginForm {
  readonly submits = new Subject<LoginRequest>();
}

@Component({
  imports: [FormsModule, ValidSubmitDirective],
  template: `
    <form (tngValidSubmit)="submits.next($event)" [tngValidSubmitShape]="shape()">
      <input name="name" ngModel />
      <button type="submit">Save</button>
    </form>
  `,
})
class ShapedForm {
  readonly submits = new Subject<unknown>();
  readonly shape = signal<Record<string, 'string' | 'number'>>({ name: 'string' });
}

@Component({
  imports: [FormsModule, ValidSubmitDirective],
  template: `
    <form (tngValidSubmit)="submits.next($event)" [tngValidSubmitShape]="{ age: 'number | null', address: { city: 'string' } }">
      <input type="number" name="age" [ngModel]="null" />
      <div ngModelGroup="address">
        <input name="city" ngModel required />
      </div>
      <button type="submit">Save</button>
    </form>
  `,
})
class NestedForm {
  readonly submits = new Subject<{ age: number | null; address: { city: string } }>();
}

@Component({
  imports: [FormsModule, ValidSubmitDirective],
  template: `
    <form (tngValidSubmit)="submits.next($event)">
      <input name="anything" ngModel />
      <button type="submit">Save</button>
    </form>
  `,
})
class UnshapedForm {
  readonly submits = new Subject<{ readonly [name: string]: unknown }>();
}

describe('ValidSubmitDirective', () => {
  let errors: unknown[];

  beforeEach(() => {
    errors = [];
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }],
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function render<C extends { submits: Observable<unknown> }>(component: new () => C) {
    const fixture = TestBed.createComponent(component);
    // Focus only moves to elements in the document
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();

    const emitted: unknown[] = [];
    fixture.componentInstance.submits.subscribe(value => emitted.push(value));

    const element: HTMLElement = fixture.nativeElement;
    const form = fixture.debugElement.children[0].injector.get(NgForm);

    return {
      fixture,
      form,
      emitted,
      input: (name: string) => element.querySelector<HTMLInputElement>(`[name="${name}"]`)!,
      type: async (name: string, value: string) => {
        const input = element.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
        await fixture.whenStable();
      },
      submit: async () => {
        element.querySelector('button')!.click();
        await fixture.whenStable();
      },
    };
  }

  it('emits the value once on a valid submit', async () => {
    const { type, submit, emitted } = await render(LoginForm);

    await type('email', 'ada@example.com');
    await type('password', 'secret');
    await submit();

    expect(emitted).toEqual([{ email: 'ada@example.com', password: 'secret' }]);
  });

  it("emits the controls' current values on each submit", async () => {
    const { type, submit, emitted } = await render(LoginForm);

    await type('email', 'ada@example.com');
    await type('password', 'first');
    await submit();
    await type('password', 'second');
    await submit();

    expect(emitted).toEqual([
      { email: 'ada@example.com', password: 'first' },
      { email: 'ada@example.com', password: 'second' },
    ]);
  });

  it('emits nothing on an invalid submit and marks every control as touched', async () => {
    const { type, submit, emitted, form } = await render(LoginForm);

    await type('email', 'not-an-email');
    await submit();

    expect(emitted).toEqual([]);
    expect(form.controls['email'].touched).toBe(true);
    expect(form.controls['password'].touched).toBe(true);
    expect(form.controls['email'].dirty).toBe(true);
    expect(form.controls['password'].dirty).toBe(false);
  });

  it('focuses the first invalid control on an invalid submit', async () => {
    const { type, submit, input } = await render(LoginForm);

    await type('email', 'ada@example.com');
    await submit();

    expect(document.activeElement).toBe(input('password'));
  });

  it('reports a value that does not match the shape and emits nothing', async () => {
    const { fixture, submit, emitted } = await render(ShapedForm);

    fixture.componentInstance.shape.set({ name: 'string', age: 'number' });
    await fixture.whenStable();
    await submit();

    expect(emitted).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain('"age" is missing');
  });

  it('reports a control that is not in the shape', async () => {
    const { fixture, submit } = await render(ShapedForm);

    fixture.componentInstance.shape.set({});
    await fixture.whenStable();
    await submit();

    expect(String(errors[0])).toContain('"name" is not in the shape');
  });

  it('reports a value of another type', async () => {
    const { fixture, submit } = await render(ShapedForm);

    fixture.componentInstance.shape.set({ name: 'number' });
    await fixture.whenStable();
    await submit();

    expect(String(errors[0])).toContain('"name" is string "", not number');
  });

  it('checks nested groups and nullable values', async () => {
    const { type, submit, emitted } = await render(NestedForm);

    await type('city', 'Ankara');
    await submit();

    expect(errors).toEqual([]);
    expect(emitted).toEqual([{ age: null, address: { city: 'Ankara' } }]);
  });

  it('emits any value without a shape', async () => {
    const { type, submit, emitted } = await render(UnshapedForm);

    await type('anything', 'x');
    await submit();

    expect(emitted).toEqual([{ anything: 'x' }]);
  });
});
