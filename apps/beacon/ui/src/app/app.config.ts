import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideSseClient } from '@telperion/ng-pack/sse-client';

import { routes } from './app.routes';
import { sessionExpiredInterceptor } from './core/auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([sessionExpiredInterceptor])),
    provideSseClient(),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
