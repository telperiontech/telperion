import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map, startWith } from 'rxjs';

/** The current time, ticking every 30 seconds, so ages ("3 h") stay current. */
@Injectable({ providedIn: 'root' })
export class Clock {
  private static readonly TICK_MS = 30_000;

  readonly now = toSignal(
    interval(Clock.TICK_MS).pipe(
      startWith(0),
      map(() => Date.now()),
    ),
    { requireSync: true },
  );
}
