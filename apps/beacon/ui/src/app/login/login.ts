import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FieldModule } from '@telperion/ng-ui/form/field';
import { Subject, catchError, exhaustMap, map, of, startWith, tap } from 'rxjs';

type LoginState = 'idle' | 'busy' | 'wrong' | 'error';

/** The admin password form. On success it opens the overview. */
@Component({
  selector: 'bcn-login',
  imports: [FieldModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private static outcome(err: unknown): LoginState {
    return err instanceof HttpErrorResponse && err.status === 401 ? 'wrong' : 'error';
  }

  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);

  protected readonly submits = new Subject<{ password: string }>();

  protected readonly state = toSignal(
    this.submits.pipe(
      exhaustMap(body =>
        this.#http.post('/api/login', body).pipe(
          tap(() => this.#router.navigateByUrl('/')),
          map((): LoginState => 'idle'),
          catchError(err => of(Login.outcome(err))),
          startWith<LoginState>('busy'),
        ),
      ),
    ),
    { initialValue: 'idle' as LoginState },
  );
}
