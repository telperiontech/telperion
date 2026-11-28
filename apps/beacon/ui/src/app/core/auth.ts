import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';

/** Lets a route through with a valid session, otherwise sends the browser to /login. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(HttpClient)
    .get<{ authenticated: boolean }>('/api/session')
    .pipe(
      map(s => s.authenticated || router.createUrlTree(['/login'])),
      catchError(() => of(router.createUrlTree(['/login']))),
    );
};

/** A 401 from the API (an expired session) leads to the login page. */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const expired = (err: unknown) => err instanceof HttpErrorResponse && err.status === 401 && !req.url.endsWith('/api/login');

  return next(req).pipe(tap({ error: (err: unknown) => expired(err) && router.navigate(['/login']) }));
};
