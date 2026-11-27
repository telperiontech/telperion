import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { FieldModule } from './field.module';

interface LoginRequest {
  email: string;
  password: string;
}

/** The sign-in form as consumers write it: one `FieldModule` import, the form logic in the template. */
@Component({
  imports: [FieldModule],
  template: `
    <form #form="ngForm" (tngValidSubmit)="submits.next($event)" [tngValidSubmitShape]="{ email: 'string', password: 'string' }">
      <tui-field label="Email" hint="Your work address">
        <input type="email" name="email" ngModel autocomplete="username" required email />
      </tui-field>
      <tui-field label="Password">
        <input type="password" name="password" ngModel autocomplete="current-password" required />
      </tui-field>
      <button type="submit" [disabled]="form.pending">Sign in</button>
    </form>
  `,
})
class LoginPage {
  readonly submits = new Subject<LoginRequest>();
}

describe('tui-field with tngValidSubmit', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function render() {
    const fixture = TestBed.createComponent(LoginPage);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    const emitted: LoginRequest[] = [];
    fixture.componentInstance.submits.subscribe(value => emitted.push(value));

    const fields = () => Array.from(element.querySelectorAll('tui-field'));

    return {
      emitted,
      input: (name: string) => element.querySelector<HTMLInputElement>(`[name="${name}"]`)!,
      invalidFields: () => fields().filter(field => field.classList.contains('invalid')).map(field => field.querySelector('input')!.name),
      infos: () => fields().map(field => field.querySelector('tui-field-info')!.textContent!.trim()),
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

  it('emits the typed values once on a valid submit', async () => {
    const { type, submit, emitted } = await render();

    await type('email', 'ada@example.com');
    await type('password', 'secret');
    await submit();

    expect(emitted).toEqual([{ email: 'ada@example.com', password: 'secret' }]);
  });

  it('shows no errors before anything is edited or submitted', async () => {
    const { invalidFields, infos } = await render();

    expect(invalidFields()).toEqual([]);
    expect(infos()).toEqual(['Your work address', '']);
  });

  it('shows the errors of untouched fields on an invalid submit and emits nothing', async () => {
    const { submit, emitted, invalidFields, infos } = await render();

    await submit();

    expect(emitted).toEqual([]);
    expect(invalidFields()).toEqual(['email', 'password']);
    expect(infos()).toEqual(['This field is required', 'This field is required']);
  });

  it('focuses the first invalid field on an invalid submit', async () => {
    const { type, submit, input } = await render();

    await type('email', 'ada@example.com');
    await submit();

    expect(document.activeElement).toBe(input('password'));
  });

  it('clears the error once the field is fixed', async () => {
    const { type, submit, invalidFields } = await render();

    await submit();
    await type('email', 'ada@example.com');

    expect(invalidFields()).toEqual(['password']);
  });
});
