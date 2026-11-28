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
import { StateBadge } from '../shared/state-badge';

type CancelState = 'idle' | 'busy' | 'failed';

/** One plan run and its steps, as they move. Live. */
@Component({
  selector: 'bcn-run-page',
  imports: [RouterLink, DatePipe, AgePipe, StateBadge],
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

  protected readonly cancels = new Subject<void>();

  protected readonly cancelling = toSignal(
    this.cancels.pipe(
      exhaustMap(() =>
        this.#http.post(`/api/runs/${this.id()}/cancel`, null).pipe(
          map((): CancelState => 'idle'),
          catchError(() => of<CancelState>('failed')),
          startWith<CancelState>('busy'),
        ),
      ),
    ),
    { initialValue: 'idle' as CancelState },
  );
}
