import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { fetcherSignal } from '@telperion/ng-pack/fetcher-signal';
import { FieldModule } from '@telperion/ng-ui/form/field';
import { Observable, Subject, catchError, exhaustMap, map, merge, of, scan, startWith, switchMap, tap } from 'rxjs';

import { ActionPreview } from '../actions/action-preview';
import { Overview, Plan, PlanStep, PlanStepType, Run, Stage, Via } from '../core/api';

/** One step row of the form, with the values it starts with. */
interface Row {
  id: number;
  step: Partial<PlanStep>;
}

/** The form's rows and the plan-level values they start with. */
interface Draft {
  next: number;
  rows: Row[];
  name: string;
  failFast: boolean;
}

/** What changes the rows: a plan to start from, a new row, a removed row. */
type DraftEvent = { kind: 'reset'; plan: Plan | undefined } | { kind: 'add' } | { kind: 'remove'; id: number };

/** One step group of the submitted form (all strings, as the controls hold them). */
interface StepValue {
  key: string;
  type: PlanStepType;
  package: string;
  needs?: string;
  bump?: string;
  version?: string;
  until?: Stage | '';
  batch?: boolean;
  deps?: string[];
  via?: Via;
  target?: string;
}

/** Where a save or export stands. */
type Outcome<T> = { status: 'idle' } | { status: 'busy' } | { status: 'ok'; value: T } | { status: 'error'; error: string; errors?: string[] };

/**
 * The plan builder: steps with needs, as a template-driven form. A submit previews the plan
 * (the preview starts it); the previewed plan can be saved as a recipe or copied as YAML for the
 * config file. It starts empty, from a recipe (?recipe=) or from a run's plan (?run=).
 */
@Component({
  selector: 'bcn-plan-builder',
  imports: [FieldModule, RouterLink, ActionPreview],
  templateUrl: './plan-builder.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanBuilder {
  private static readonly EMPTY: Draft = { next: 1, rows: [{ id: 0, step: {} }], name: '', failFast: false };

  private static reduce(d: Draft, e: DraftEvent): Draft {
    switch (e.kind) {
      case 'add':
        return { ...d, next: d.next + 1, rows: [...d.rows, { id: d.next, step: {} }] };
      case 'remove':
        return { ...d, rows: d.rows.filter(r => r.id !== e.id) };
      case 'reset':
        return e.plan
          ? {
              next: d.next + e.plan.steps.length,
              rows: e.plan.steps.map((step, i) => ({ id: d.next + i, step })),
              name: e.plan.name ?? '',
              failFast: e.plan.failFast ?? false,
            }
          : { ...PlanBuilder.EMPTY, next: d.next + 1, rows: [{ id: d.next, step: {} }] };
    }
  }

  /** The submitted form as a plan: step groups are named s<row id>, in row order. */
  private static toPlan(value: Record<string, unknown>): Plan {
    const steps = Object.entries(value)
      .filter(([name]) => /^s\d+$/.test(name))
      .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))
      .map(([, v]) => PlanBuilder.toStep(v as StepValue));
    const name = String(value['name'] ?? '').trim();
    return { ...(name ? { name } : {}), failFast: value['failFast'] === true, steps };
  }

  private static toStep(v: StepValue): PlanStep {
    const needs = (v.needs ?? '').split(',').map(n => n.trim()).filter(Boolean);
    const step: PlanStep = { key: v.key.trim(), type: v.type, package: v.package, ...(needs.length ? { needs } : {}) };
    switch (v.type) {
      case 'release':
        return {
          ...step,
          ...(v.bump ? { bump: v.bump } : {}),
          ...(v.version ? { version: v.version.trim() } : {}),
          ...(v.until ? { until: v.until } : {}),
          ...(v.batch === false ? { noBatch: true } : {}),
        };
      case 'update-deps':
        return { ...step, deps: v.deps ?? [], via: v.via ?? 'commit' };
      case 'deploy':
        return { ...step, target: v.target?.trim() ?? '', ...(v.version ? { version: v.version.trim() } : {}) };
    }
  }

  private static failure(err: unknown): Outcome<never> {
    if (err instanceof HttpErrorResponse) {
      return { status: 'error', error: err.error?.error ?? err.message, errors: err.error?.errors };
    }
    return { status: 'error', error: String(err) };
  }

  /** POSTs or PUTs for each trigger, one at a time, as an outcome. */
  private static outcome<T>(triggers: Observable<void>, send: () => Observable<T>): Observable<Outcome<T>> {
    return triggers.pipe(
      exhaustMap(() =>
        send().pipe(
          map((value): Outcome<T> => ({ status: 'ok', value })),
          catchError(err => of(PlanBuilder.failure(err))),
          startWith<Outcome<T>>({ status: 'busy' }),
        ),
      ),
    );
  }

  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);

  /** ?recipe=: start from a copy of this recipe. */
  readonly recipe = input<string>();
  /** ?run=: start from the plan of this run. */
  readonly run = input<string>();

  protected readonly overview = fetcherSignal<Overview | null>({ url: '/api/overview', fallback: null });
  protected readonly packages = computed(() => (this.overview()?.packages ?? []).map(p => p.name).sort());
  protected readonly targets = computed(() => [...new Set((this.overview()?.packages ?? []).flatMap(p => p.targets))].sort());

  readonly #seed = toObservable(computed(() => ({ recipe: this.recipe(), run: this.run() }))).pipe(
    switchMap(({ recipe, run }): Observable<Plan | undefined> => {
      if (recipe) {
        return this.#http.get<Plan[]>('/api/recipes').pipe(
          map(all => all.find(p => p.name === recipe)),
          map(p => p && { ...p, name: `${p.name}-copy`, managed: false }),
        );
      }
      if (run) {
        return this.#http.get<Run>(`/api/runs/${encodeURIComponent(run)}`).pipe(map(r => r.plan));
      }
      return of(undefined);
    }),
    catchError(() => of(undefined)),
  );

  protected readonly adds = new Subject<void>();
  protected readonly removes = new Subject<number>();

  protected readonly draft = toSignal(
    merge(
      this.#seed.pipe(map((plan): DraftEvent => ({ kind: 'reset', plan }))),
      this.adds.pipe(map((): DraftEvent => ({ kind: 'add' }))),
      this.removes.pipe(map((id): DraftEvent => ({ kind: 'remove', id }))),
    ).pipe(scan(PlanBuilder.reduce, PlanBuilder.EMPTY)),
    { initialValue: PlanBuilder.EMPTY },
  );

  protected readonly submits = new Subject<Record<string, unknown>>();
  protected readonly closes = new Subject<void>();
  /** The plan last submitted (null once the preview is closed): what is previewed, saved or exported. */
  protected readonly plan = toSignal(
    merge(this.submits.pipe(map(PlanBuilder.toPlan)), this.closes.pipe(map(() => null))),
    { initialValue: null },
  );
  protected readonly request = computed(() => {
    const plan = this.plan();
    return plan && { plan };
  });

  protected readonly saves = new Subject<void>();
  protected readonly saved = toSignal(
    merge(
      this.submits.pipe(map((): Outcome<Plan> => ({ status: 'idle' }))),
      PlanBuilder.outcome(this.saves, () => {
        const plan = this.plan()!;
        return this.#http
          .put<Plan>(`/api/recipes/${encodeURIComponent(plan.name ?? '')}`, plan)
          .pipe(tap(() => this.#router.navigate(['/plans'])));
      }),
    ),
    { initialValue: { status: 'idle' } as Outcome<Plan> },
  );

  protected readonly exports = new Subject<void>();
  protected readonly exported = toSignal(
    merge(
      this.submits.pipe(map((): Outcome<string> => ({ status: 'idle' }))),
      PlanBuilder.outcome(this.exports, () =>
        this.#http.post<{ yaml: string }>('/api/recipes/yaml', this.plan()).pipe(map(r => r.yaml)),
      ),
    ),
    { initialValue: { status: 'idle' } as Outcome<string> },
  );
}
