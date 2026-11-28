import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Cell, Stage, VersionCells } from '../core/api';

/** A version's chain as a row of stages, each coloured by its state and linked to its source. */
@Component({
  selector: 'bcn-stage-pipeline',
  template: `
    <ol class="flex flex-wrap items-center gap-1 text-xs">
      @for (s of stages(); track s.stage; let last = $last) {
        <li>
          @if (s.cell.url) {
            <a [href]="s.cell.url" target="_blank" rel="noopener" [class]="s.classes" [title]="s.title">{{ s.stage }}</a>
          } @else {
            <span [class]="s.classes" [title]="s.title">{{ s.stage }}</span>
          }
        </li>
        @if (!last) {
          <li aria-hidden="true" class="text-neutral-400">→</li>
        }
      }
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StagePipeline {
  private static readonly STATE_CLASSES: Record<Cell['state'], string> = {
    ok: 'bg-success/15 text-success border-success/40',
    pending: 'bg-warning/15 text-warning border-warning/40 animate-pulse',
    failed: 'bg-danger/15 text-danger border-danger/40',
    missing: 'bg-transparent text-neutral-400 border-neutral-300 border-dashed',
  };

  readonly chain = input.required<Stage[]>();
  readonly version = input<VersionCells | null>(null);

  protected readonly stages = computed(() =>
    this.chain().map(stage => {
      const cell = this.version()?.cells[stage] ?? { state: 'missing' as const };

      return {
        stage,
        cell,
        classes: `inline-block rounded border px-2 py-0.5 ${StagePipeline.STATE_CLASSES[cell.state]}`,
        title: [cell.state, cell.detail].filter(Boolean).join(': '),
      };
    }),
  );
}
