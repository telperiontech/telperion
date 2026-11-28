import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';

import { Overview as OverviewData } from '../core/api';
import { Live } from '../core/live';
import { PackageCard } from './package-card';

/** The main screen: every package with its newest version's chain; packages with gaps first. Live. */
@Component({
  selector: 'bcn-overview',
  imports: [PackageCard],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {
  protected readonly overview = fetcherSignal<OverviewData | null>({
    url: '/api/overview',
    fallback: null,
    reloadOn: inject(Live).settled$,
  });

  protected readonly packages = computed(() => this.overview()?.packages ?? []);
  protected readonly gapCount = computed(() => this.packages().filter(p => p.gaps.length > 0).length);
}
