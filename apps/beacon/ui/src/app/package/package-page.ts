import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';
import { FieldModule } from '@telperion/ng-ui/form/field';
import { Subject, map, merge } from 'rxjs';

import { ActionPreview } from '../actions/action-preview';
import { ActionRequest, PackageDetail, VersionCells } from '../core/api';
import { Clock } from '../core/clock';
import { Live } from '../core/live';
import { AgePipe } from '../shared/age.pipe';
import { StagePipeline } from '../shared/stage-pipeline';
import { StateBadge } from '../shared/state-badge';

/**
 * One package: every version with its chain (newest first), the actions its adapters support
 * (release, deploy, re-run), its plan runs and the recent events. Live.
 */
@Component({
  selector: 'bcn-package-page',
  imports: [RouterLink, DatePipe, FieldModule, StagePipeline, AgePipe, StateBadge, ActionPreview],
  templateUrl: './package-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackagePage {
  /** Targets a version can be deployed to: it is published (or has no artifact stage) and not running there. */
  private static deployTargets(d: PackageDetail, v: VersionCells): string[] {
    const published = !d.chain.includes('published') || v.cells.published?.state === 'ok';
    const running = new Set(v.cells.deployed?.targets?.filter(t => t.state === 'ok').map(t => t.target));
    return published ? d.actions.deploy.filter(t => !running.has(t)) : [];
  }

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

  /** Per version, the targets it can be deployed to. */
  protected readonly deployable = computed(() => {
    const d = this.detail();
    return new Map(d?.versions.map(v => [v.version, PackagePage.deployTargets(d, v)]) ?? []);
  });

  /** Actions asked for (a release form, a deploy or re-run button); null closes the preview. */
  protected readonly requests = new Subject<ActionRequest | null>();

  /** The action being previewed; closed when another package opens. */
  protected readonly request = toSignal(
    merge(this.requests, toObservable(this.name).pipe(map(() => null))),
    { initialValue: null },
  );
}
