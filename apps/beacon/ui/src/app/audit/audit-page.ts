import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';

import { AuditEntry } from '../core/api';

/** Who did what: logins and config applies (later: releases and deploys). */
@Component({
  selector: 'bcn-audit-page',
  imports: [DatePipe],
  template: `
    <h1 class="mb-4 text-xl font-semibold">Audit log</h1>
    <table class="w-full text-left text-sm">
      <thead class="text-neutral-500">
        <tr><th class="py-1">When</th><th>Source</th><th>Actor</th><th>Action</th><th>Object</th><th>Detail</th></tr>
      </thead>
      <tbody>
        @for (e of entries(); track e.id) {
          <tr class="border-t border-neutral-200 dark:border-neutral-800">
            <td class="py-1 whitespace-nowrap">{{ e.at | date: 'short' }}</td>
            <td>{{ e.source }}</td>
            <td class="font-mono">{{ e.actor }}</td>
            <td>{{ e.action }}</td>
            <td>{{ e.object }}</td>
            <td class="text-neutral-500">{{ e.detail }}</td>
          </tr>
        } @empty {
          <tr><td colspan="6" class="py-2 text-neutral-500">Nothing recorded yet.</td></tr>
        }
      </tbody>
    </table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage {
  protected readonly entries = fetcherSignal<AuditEntry[]>({ url: '/api/audit?limit=200', fallback: [] });
}
