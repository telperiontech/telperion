import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';

import { PackageDetail } from '../core/api';
import { Clock } from '../core/clock';
import { Live } from '../core/live';
import { AgePipe } from '../shared/age.pipe';
import { StagePipeline } from '../shared/stage-pipeline';

/** One package: every version with its chain (newest first) and the recent events. Live. */
@Component({
  selector: 'bcn-package-page',
  imports: [RouterLink, DatePipe, StagePipeline, AgePipe],
  templateUrl: './package-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackagePage {
  /** The route's :name. */
  readonly name = input.required<string>();

  protected readonly now = inject(Clock).now;

  protected readonly detail = fetcherSignal<PackageDetail | null, null, { name: string }>({
    url: '/api/packages/:name',
    params: computed(() => ({ name: this.name() })),
    fallback: null,
    reloadOn: inject(Live).changesOf(() => this.name()),
  });

  protected readonly gapVersions = computed(() => new Set(this.detail()?.gaps.map(g => g.version)));
}
