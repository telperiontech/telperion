import { Injectable, inject } from '@angular/core';
import { SseClient } from '@telperion/ng-pack/sse-client';
import { Observable, debounceTime, filter, map, retry, share, timer } from 'rxjs';

import { Notice } from './api';

/**
 * Beacon's live updates: one SSE connection (/api/events) shared by every view.
 * Each message names the packages and plan runs that changed; views re-read
 * what they show (fetcherSignal's `reloadOn`).
 */
@Injectable({ providedIn: 'root' })
export class Live {
  private static readonly RECONNECT_MS = 5000;
  private static readonly SETTLE_MS = 300;

  /** One notice per server message. */
  readonly notices$: Observable<Notice> = inject(SseClient)
    .start<string>('/api/events')
    .pipe(
      map(data => JSON.parse(data) as Notice),
      retry({ delay: () => timer(Live.RECONNECT_MS) }),
      share(),
    );

  /** Any change, after a burst of messages settles. */
  readonly settled$: Observable<Notice> = this.notices$.pipe(debounceTime(Live.SETTLE_MS));

  /** Changes of plan runs, after a burst settles. */
  readonly runs$: Observable<Notice> = this.notices$.pipe(
    filter(n => (n.runs?.length ?? 0) > 0),
    debounceTime(Live.SETTLE_MS),
  );

  /** Changes of one package, after a burst settles. */
  changesOf(name: () => string): Observable<Notice> {
    return this.notices$.pipe(
      filter(n => n.packages.includes(name())),
      debounceTime(Live.SETTLE_MS),
    );
  }

  /** Changes of one plan run, after a burst settles. */
  runChanges(id: () => number): Observable<Notice> {
    return this.notices$.pipe(
      filter(n => n.runs?.includes(id()) ?? false),
      debounceTime(Live.SETTLE_MS),
    );
  }
}
