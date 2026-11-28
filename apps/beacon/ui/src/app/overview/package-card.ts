import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PackageView } from '../core/api';
import { Clock } from '../core/clock';
import { AgePipe } from '../shared/age.pipe';
import { StagePipeline } from '../shared/stage-pipeline';

/** One package on the overview: newest version, its chain, its gaps with their age, and links. */
@Component({
  selector: 'bcn-package-card',
  imports: [RouterLink, StagePipeline, AgePipe],
  templateUrl: './package-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackageCard {
  readonly pkg = input.required<PackageView>();
  protected readonly now = inject(Clock).now;
}
