import { Routes } from '@angular/router';

import { authGuard } from './core/auth';
import { Login } from './login/login';
import { Overview } from './overview/overview';

export const routes: Routes = [
  { path: 'login', component: Login, title: 'Log in · Beacon' },
  { path: '', component: Overview, canActivate: [authGuard], title: 'Beacon' },
  {
    path: 'packages/:name',
    canActivate: [authGuard],
    loadComponent: () => import('./package/package-page').then(m => m.PackagePage),
    title: 'Package · Beacon',
  },
  {
    path: 'status',
    canActivate: [authGuard],
    loadComponent: () => import('./status/status-page').then(m => m.StatusPage),
    title: 'Polling · Beacon',
  },
  {
    path: 'audit',
    canActivate: [authGuard],
    loadComponent: () => import('./audit/audit-page').then(m => m.AuditPage),
    title: 'Audit · Beacon',
  },
  { path: '**', redirectTo: '' },
];
