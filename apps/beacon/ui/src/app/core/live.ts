import { Injectable, inject } from '@angular/core';
import { SseClient } from '@telperion/ng-pack/sse-client';
import { Observable, debounceTime, filter, map, retry, share, timer } from 'rxjs';

/**
 * Beacon's live updates: one SSE connection (/api/events) shared by every view.
 * Each message names the packages that changed; views re-read what they show
 * (fetcherSignal's `reloadOn`).
 */
@Injectable({ providedIn: 'root' })
export class Live {
  private static readonly RECONNECT_MS = 5000;
  private static readonly SETTLE_MS = 300;

  /** Names of changed packages, one batch per server message. */
  readonly changes$: Observable<string[]> = inject(SseClient)
    .start<string>('/api/events')
    .pipe(
      map(data => (JSON.parse(data) as { packages: string[] }).packages),
      retry({ delay: () => timer(Live.RECONNECT_MS) }),
      share(),
    );

  /** Any change, after a burst of messages settles. */
  readonly settled$: Observable<string[]> = this.changes$.pipe(debounceTime(Live.SETTLE_MS));

  /** Changes of one package, after a burst settles. */
  changesOf(name: () => string): Observable<string[]> {
    return this.changes$.pipe(
      filter(names => names.includes(name())),
      debounceTime(Live.SETTLE_MS),
    );
  }
}
