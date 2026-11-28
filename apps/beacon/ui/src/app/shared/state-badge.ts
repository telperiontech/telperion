import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { RunState, StepState } from '../core/api';

/** A plan run's or step's state as a coloured label. */
@Component({
  selector: 'bcn-state-badge',
  template: `<span class="rounded border px-1.5 py-0.5 text-xs" [class]="classes()">{{ state() }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateBadge {
  private static readonly CLASSES: Record<StepState | RunState, string> = {
    done: 'bg-success/15 text-success border-success/40',
    running: 'bg-warning/15 text-warning border-warning/40 animate-pulse',
    triggering: 'bg-warning/15 text-warning border-warning/40 animate-pulse',
    paused: 'bg-primary/10 text-primary border-primary/40',
    failed: 'bg-danger/15 text-danger border-danger/40',
    skipped: 'bg-danger/10 text-danger border-danger/30',
    blocked: 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300',
    waiting: 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300',
    ready: 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300',
    cancelled: 'bg-neutral-100 text-neutral-500 border-neutral-300 line-through dark:bg-neutral-800',
  };

  readonly state = input.required<StepState | RunState>();
  protected readonly classes = computed(() => StateBadge.CLASSES[this.state()]);
}
