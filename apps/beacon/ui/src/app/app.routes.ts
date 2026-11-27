import { Routes } from '@angular/router';

import { Overview } from './overview/overview';

export const routes: Routes = [
  { path: '', component: Overview, title: 'Beacon' },
  { path: '**', redirectTo: '' },
];
