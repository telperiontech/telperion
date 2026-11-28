import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StepState, StepType } from '../core/api';

/** What the graph draws of a step: a plan step, a previewed step or a run's step. */
export interface GraphStep {
  key: string;
  type: StepType;
  package: string;
  version?: string;
  target?: string;
  needs?: string[];
  state?: StepState;
}

interface Node {
  step: GraphStep;
  x: number;
  y: number;
}

interface Edge {
  key: string;
  d: string;
}

interface Layout {
  nodes: Node[];
  edges: Edge[];
  width: number;
  height: number;
}

/**
 * A plan's steps as a DAG, left to right: each step sits in the column of its longest chain of
 * needs, so everything it needs is to its left. Plain SVG, no graph library.
 */
@Component({
  selector: 'bcn-plan-graph',
  template: `
    @if (layout(); as l) {
      <div class="overflow-x-auto">
        <svg [attr.width]="l.width" [attr.height]="l.height" [attr.viewBox]="'0 0 ' + l.width + ' ' + l.height"
          role="img" [attr.aria-label]="label()" class="text-neutral-400">
          <defs>
            <marker id="bcn-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
            </marker>
          </defs>
          @for (e of l.edges; track e.key) {
            <path [attr.d]="e.d" fill="none" stroke="currentColor" stroke-width="1.5" marker-end="url(#bcn-arrow)" />
          }
          @for (n of l.nodes; track n.step.key) {
            <g [attr.transform]="'translate(' + n.x + ',' + n.y + ')'">
              <title>{{ n.step.key }}: {{ caption(n.step) }}{{ n.step.state ? ' (' + n.step.state + ')' : '' }}</title>
              <rect [attr.width]="w" [attr.height]="h" rx="6" stroke-width="1.5" [attr.class]="fill(n.step.state)" />
              <text x="10" y="19" class="fill-neutral-900 text-xs font-semibold dark:fill-neutral-100">{{ clip(n.step.key) }}</text>
              <text x="10" y="36" class="fill-neutral-500 text-[11px]">{{ clip(caption(n.step)) }}</text>
            </g>
          }
        </svg>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanGraph {
  private static readonly W = 168;
  private static readonly H = 46;
  private static readonly GAP_X = 44;
  private static readonly GAP_Y = 12;
  private static readonly MAX_CHARS = 24;

  private static readonly FILLS: Partial<Record<StepState, string>> = {
    done: 'fill-success/15 stroke-success',
    running: 'fill-warning/15 stroke-warning',
    triggering: 'fill-warning/15 stroke-warning',
    paused: 'fill-primary/10 stroke-primary',
    failed: 'fill-danger/15 stroke-danger',
    skipped: 'fill-danger/5 stroke-danger/60',
    cancelled: 'fill-neutral-100 stroke-neutral-300 dark:fill-neutral-800',
  };
  private static readonly DEFAULT_FILL = 'fill-white stroke-neutral-300 dark:fill-neutral-900 dark:stroke-neutral-600';

  /** Each step's column: the length of its longest chain of needs (a need on a cycle is left out). */
  private static columns(steps: GraphStep[]): Map<string, number> {
    const byKey = new Map(steps.map(s => [s.key, s]));
    const depth = (key: string, path: Set<string>): number => {
      const needs = (byKey.get(key)?.needs ?? []).filter(n => byKey.has(n) && !path.has(n));
      return needs.length ? 1 + Math.max(...needs.map(n => depth(n, new Set([...path, n])))) : 0;
    };
    return new Map(steps.map(s => [s.key, depth(s.key, new Set([s.key]))]));
  }

  private static layout(steps: GraphStep[]): Layout | null {
    if (steps.length === 0) return null;
    const { W, H, GAP_X, GAP_Y } = PlanGraph;
    const columns = PlanGraph.columns(steps);
    const rows = new Map<number, number>();
    const nodes = steps.map(step => {
      const col = columns.get(step.key) ?? 0;
      const row = rows.get(col) ?? 0;
      rows.set(col, row + 1);
      return { step, x: col * (W + GAP_X) + 1, y: row * (H + GAP_Y) + 1 };
    });
    const at = new Map(nodes.map(n => [n.step.key, n]));
    const edges = nodes.flatMap(n =>
      (n.step.needs ?? []).flatMap(need => {
        const from = at.get(need);
        if (!from) return [];
        const [x1, y1, x2, y2] = [from.x + W, from.y + H / 2, n.x - 2, n.y + H / 2];
        const mid = (x1 + x2) / 2;
        return [{ key: `${need}>${n.step.key}`, d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}` }];
      }),
    );
    const cols = Math.max(...columns.values()) + 1;
    const maxRows = Math.max(...rows.values());
    return { nodes, edges, width: cols * (W + GAP_X) - GAP_X + 2, height: maxRows * (H + GAP_Y) - GAP_Y + 2 };
  }

  private static fill(state: StepState | undefined): string {
    return (state && PlanGraph.FILLS[state]) || PlanGraph.DEFAULT_FILL;
  }

  private static caption(s: GraphStep): string {
    const what = s.type === 'deploy' ? `deploy ${s.package} on ${s.target ?? ''}` : `${s.type} ${s.package}`;
    return s.version ? `${what} ${s.version}` : what;
  }

  private static clip(text: string): string {
    return text.length > PlanGraph.MAX_CHARS ? text.slice(0, PlanGraph.MAX_CHARS - 1) + '…' : text;
  }

  /** The steps to draw. */
  readonly steps = input.required<GraphStep[]>();

  protected readonly w = PlanGraph.W;
  protected readonly h = PlanGraph.H;
  protected readonly layout = computed(() => PlanGraph.layout(this.steps()));
  protected readonly label = computed(() => `Plan of ${this.steps().length} steps`);
  protected readonly fill = PlanGraph.fill;
  protected readonly caption = PlanGraph.caption;
  protected readonly clip = PlanGraph.clip;
}
