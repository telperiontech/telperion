import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';
import { interval } from 'rxjs';

import { JobStatus } from '../core/api';
import { Clock } from '../core/clock';
import { AgePipe } from '../shared/age.pipe';

/** The observation loop: every poll job, how closely it is watched, and its last error. */
@Component({
  selector: 'bcn-status-page',
  imports: [DatePipe, AgePipe],
  templateUrl: './status-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPage {
  private static readonly REFRESH_MS = 15_000;

  protected readonly now = inject(Clock).now;

  protected readonly jobs = fetcherSignal<JobStatus[]>({
    url: '/api/status',
    fallback: [],
    reloadOn: interval(StatusPage.REFRESH_MS),
  });
}
