import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';
import { Subject, catchError, exhaustMap, filter, map, merge, of, share, startWith } from 'rxjs';

import { ActionPreview } from '../actions/action-preview';
import { ActionRequest, Plan } from '../core/api';
import { PlanGraph } from '../shared/plan-graph';

/** Where the last delete stands: null when nothing failed. */
type DeleteState = { name: string; error: string } | null;

/**
 * The recipes: saved plans from the config file (managed, read-only here) and from the plan
 * builder. A recipe is previewed and started like any action; a copy opens in the builder.
 */
@Component({
  selector: 'bcn-plans-page',
  imports: [RouterLink, ActionPreview, PlanGraph],
  template: `
    <header class="mb-4 flex items-center gap-3">
      <h1 class="text-xl font-semibold">Plans</h1>
      <a routerLink="/plans/new" class="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white">New plan</a>
    </header>

    @if (request(); as r) {
      <div class="mb-4">
        <bcn-action-preview [request]="r" (closed)="requests.next(null)" />
      </div>
    }
    @if (deleteFailure(); as f) {
      <p class="mb-3 text-sm text-danger" role="alert">{{ f.name }} was not deleted: {{ f.error }}</p>
    }

    <ul class="flex flex-col gap-3">
      @for (p of recipes(); track p.name) {
        <li class="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <span class="font-mono font-semibold">{{ p.name }}</span>
            <span class="text-xs text-neutral-500">
              {{ p.steps.length }} steps · {{ p.managed ? 'from the config file' : 'saved in Beacon' }}{{ p.failFast ? ' · fail-fast' : '' }}
            </span>
            <span class="ml-auto flex gap-2 text-sm">
              <button type="button" class="rounded-md bg-primary px-3 py-1 font-medium text-white" (click)="requests.next({ recipe: p.name })">
                Preview and run
              </button>
              <a [routerLink]="['/plans/new']" [queryParams]="{ recipe: p.name }"
                class="rounded-md border border-neutral-300 px-3 py-1 dark:border-neutral-700">Copy into the builder</a>
              @if (!p.managed) {
                <button type="button" class="rounded-md border border-neutral-300 px-3 py-1 text-danger dark:border-neutral-700"
                  (click)="deletes.next(p.name!)">Delete</button>
              }
            </span>
          </div>
          <bcn-plan-graph [steps]="p.steps" />
        </li>
      } @empty {
        <li class="text-sm text-neutral-500">
          No recipes yet. Add them under <code>recipes:</code> in the config file, or build a plan and save it.
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansPage {
  private static message(err: unknown): string {
    return err instanceof HttpErrorResponse ? (err.error?.error ?? err.message) : String(err);
  }

  readonly #http = inject(HttpClient);

  protected readonly requests = new Subject<ActionRequest | null>();
  protected readonly request = toSignal(this.requests, { initialValue: null });

  protected readonly deletes = new Subject<string>();
  readonly #deleted = this.deletes.pipe(
    exhaustMap(name =>
      this.#http.delete(`/api/recipes/${encodeURIComponent(name)}`).pipe(
        map((): DeleteState => null),
        catchError(err => of<DeleteState>({ name, error: PlansPage.message(err) })),
      ),
    ),
    share(),
  );

  protected readonly deleteFailure = toSignal(merge(this.deletes.pipe(map(() => null)), this.#deleted).pipe(startWith(null)), {
    initialValue: null,
  });

  protected readonly recipes = fetcherSignal<Plan[]>({
    url: '/api/recipes',
    fallback: [],
    reloadOn: this.#deleted.pipe(filter(d => d === null)),
  });
}
