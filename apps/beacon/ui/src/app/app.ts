import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject, exhaustMap, filter, map, tap } from 'rxjs';

/** The page frame: header with navigation and logout, and the routed screen. */
@Component({
  selector: 'bcn-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly #router = inject(Router);
  readonly #http = inject(HttpClient);

  /** The navigation is hidden on the login page. */
  protected readonly loggedIn = toSignal(
    this.#router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => !e.urlAfterRedirects.startsWith('/login')),
    ),
    { initialValue: false },
  );

  protected readonly logouts = new Subject<void>();

  protected readonly loggedOut = toSignal(
    this.logouts.pipe(
      exhaustMap(() => this.#http.post('/api/logout', null)),
      tap(() => this.#router.navigate(['/login'])),
    ),
  );
}
