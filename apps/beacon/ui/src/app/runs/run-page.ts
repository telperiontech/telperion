import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, numberAttribute } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';
import { Subject, catchError, exhaustMap, map, of, startWith } from 'rxjs';

import { Run } from '../core/api';
import { Clock } from '../core/clock';
import { Live } from '../core/live';
import { AgePipe } from '../shared/age.pipe';
import { PlanGraph } from '../shared/plan-graph';
import { StateBadge } from '../shared/state-badge';

/** Where a cancel or resume request stands. */
type RequestState = 'idle' | 'busy' | 'failed';

/**
 * One plan run and its steps, as they move: cancel a running run, resume a failed or cancelled one
 * (done steps stay done), or copy its plan into the plan builder. Live.
 */
@Component({
  selector: 'bcn-run-page',
  imports: [RouterLink, DatePipe, AgePipe, StateBadge, PlanGraph],
  templateUrl: './run-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunPage {
  readonly #http = inject(HttpClient);

  /** The route's :id. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly now = inject(Clock).now;

  protected readonly run = fetcherSignal<Run | null, null, { id: string }>({
    url: '/api/runs/:id',
    params: computed(() => ({ id: String(this.id()) })),
    fallback: null,
    reloadOn: inject(Live).runChanges(() => this.id()),
  });

  /** POSTs to /api/runs/:id/<what> for each value of requests, one at a time. */
  private static requestState(http: HttpClient, id: () => number, what: string, requests: Subject<void>) {
    return toSignal(
      requests.pipe(
        exhaustMap(() =>
          http.post(`/api/runs/${id()}/${what}`, null).pipe(
            map((): RequestState => 'idle'),
            catchError(() => of<RequestState>('failed')),
            startWith<RequestState>('busy'),
          ),
        ),
      ),
      { initialValue: 'idle' as RequestState },
    );
  }

  protected readonly cancels = new Subject<void>();
  protected readonly cancelling = RunPage.requestState(this.#http, () => this.id(), 'cancel', this.cancels);

  protected readonly resumes = new Subject<void>();
  protected readonly resuming = RunPage.requestState(this.#http, () => this.id(), 'resume', this.resumes);
}
