import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';
import { FieldModule } from '@telperion/ng-ui/form/field';
import { Subject, catchError, exhaustMap, map, merge, of, startWith, tap } from 'rxjs';

import { ActionRequest, Preview } from '../core/api';

/** What came of the last confirmation. */
type Outcome =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'refused'; error: string; preview: Preview } // the state moved, or a check failed
  | { status: 'error'; error: string };

/** What the user confirms: the preview they saw, and the tick for a major version. */
interface Confirmation {
  fingerprint: string;
  major: boolean;
}

/**
 * The preview of one action and its confirmation. Nothing is written until the user starts it;
 * the server checks that the preview still holds and answers with the new one if it moved.
 * On start it opens the run.
 */
@Component({
  selector: 'bcn-action-preview',
  imports: [FieldModule],
  templateUrl: './action-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionPreview {
  private static failure(err: unknown): Outcome {
    if (err instanceof HttpErrorResponse && err.error?.preview) {
      return { status: 'refused', error: err.error.error, preview: err.error.preview as Preview };
    }
    const message = err instanceof HttpErrorResponse ? (err.error?.error ?? err.message) : String(err);
    return { status: 'error', error: message };
  }

  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);

  /** The action to preview. */
  readonly request = input.required<ActionRequest>();
  /** The user closed the preview without starting. */
  readonly closed = output<void>();

  protected readonly fetched = fetcherSignal<Preview | null, ActionRequest>({
    url: '/api/actions/preview',
    method: 'post',
    body: this.request,
    fallback: null,
  });

  protected readonly confirms = new Subject<Confirmation>();

  protected readonly outcome = toSignal(
    merge(
      toObservable(this.request).pipe(map((): Outcome => ({ status: 'idle' }))),
      this.confirms.pipe(
        exhaustMap(confirm =>
          this.#http.post<{ run: number }>('/api/actions', { ...this.request(), confirm }).pipe(
            tap(({ run }) => this.#router.navigate(['/runs', run])),
            map((): Outcome => ({ status: 'idle' })),
            catchError(err => of(ActionPreview.failure(err))),
            startWith<Outcome>({ status: 'busy' }),
          ),
        ),
      ),
    ),
    { initialValue: { status: 'idle' } as Outcome },
  );

  /** Why the last start was refused or failed. */
  protected readonly failure = computed(() => {
    const o = this.outcome();
    return 'error' in o ? o.error : null;
  });

  /** The preview shown: the server's newer one after a refused start. */
  protected readonly preview = computed(() => {
    const o = this.outcome();
    return o.status === 'refused' ? o.preview : this.fetched();
  });
}
