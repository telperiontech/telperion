import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';

import { Run } from '../core/api';
import { Clock } from '../core/clock';
import { Live } from '../core/live';
import { AgePipe } from '../shared/age.pipe';
import { StateBadge } from '../shared/state-badge';

/** Every plan run (one-click actions are one-step runs), newest first. Live. */
@Component({
  selector: 'bcn-runs-page',
  imports: [RouterLink, DatePipe, AgePipe, StateBadge],
  template: `
    <h1 class="mb-4 text-xl font-semibold">Runs</h1>
    <table class="w-full text-left text-sm">
      <thead class="text-neutral-500">
        <tr><th class="py-1">#</th><th>What</th><th>State</th><th>Started</th><th>By</th></tr>
      </thead>
      <tbody>
        @for (r of runs(); track r.id) {
          <tr class="border-t border-neutral-200 dark:border-neutral-800">
            <td class="py-1"><a [routerLink]="['/runs', r.id]" class="hover:underline">{{ r.id }}</a></td>
            <td><a [routerLink]="['/runs', r.id]" class="hover:underline">{{ r.title }}</a></td>
            <td><bcn-state-badge [state]="r.state" /></td>
            <td [title]="r.created | date: 'medium'">{{ r.created | age: now() }} ago</td>
            <td class="text-neutral-500">{{ r.source }}</td>
          </tr>
        } @empty {
          <tr><td colspan="5" class="py-2 text-neutral-500">Nothing has run yet. Start a release from a package's page, or a plan from Plans.</td></tr>
        }
      </tbody>
    </table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunsPage {
  protected readonly now = inject(Clock).now;
  protected readonly runs = fetcherSignal<Run[]>({
    url: '/api/runs?limit=100',
    fallback: [],
    reloadOn: inject(Live).runs$,
  });
}
