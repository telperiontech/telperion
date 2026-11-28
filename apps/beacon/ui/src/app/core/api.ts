/** The JSON shapes of Beacon's API (internal/api, internal/model, internal/store). */

export type Stage = 'tagged' | 'built' | 'published' | 'deployed';
export type State = 'missing' | 'pending' | 'ok' | 'failed';

export interface TargetCell {
  target: string;
  state: State;
  since?: string;
  url?: string;
  detail?: string;
}

export interface Cell {
  state: State;
  since?: string;
  url?: string;
  detail?: string;
  targets?: TargetCell[];
}

export interface VersionCells {
  version: string;
  firstSeen: string;
  cells: Partial<Record<Stage, Cell>>;
}

export interface Gap {
  version: string;
  from: Stage;
  to: Stage;
  state: State;
  since: string;
  stuck: boolean;
}

export interface Links {
  repo?: string;
  ci?: string;
  registry?: string;
}

export interface PackageView {
  name: string;
  project: string;
  chain: Stage[];
  targets: string[];
  latest: VersionCells | null;
  gaps: Gap[];
  links: Links;
  actions: Actions;
  unreleased?: Unreleased;
  activeRun?: RunRef;
}

export interface Overview {
  packages: PackageView[];
  at: string;
}

export interface BeaconEvent {
  id: number;
  at: string;
  package: string;
  version: string;
  stage: Stage;
  target?: string;
  state: State;
  url?: string;
  detail?: string;
}

export interface PackageDetail extends PackageView {
  versions: VersionCells[];
  events: BeaconEvent[];
  runs: Run[];
}

export interface AuditEntry {
  id: number;
  at: string;
  source: string;
  actor: string;
  action: string;
  object: string;
  detail: string;
}

export interface JobStatus {
  key: string;
  layer: string;
  packages: string[];
  tier: 'hot' | 'warm' | 'cold' | 'backoff';
  lastPoll?: string;
  nextPoll: string;
  lastError?: string;
  failures: number;
}

export interface Actions {
  release: boolean;
  deploy: string[];
  rerun: boolean;
}

export interface Unreleased {
  package: string;
  tag: string;
  branch: string;
  commits: number;
  url?: string;
  checked?: string;
}

export interface RunRef {
  id: number;
  title: string;
}

export type ActionKind = 'release' | 'deploy' | 'rerun';

/** What a step of a plan does. A re-run is a one-click action only. */
export type PlanStepType = 'release' | 'update-deps' | 'deploy';
export type StepType = PlanStepType | 'rerun';
export type Via = 'commit' | 'pr';

/** One step of a plan as written (model.PlanStep). */
export interface PlanStep {
  key: string;
  type: PlanStepType;
  package: string;
  needs?: string[];
  bump?: string;
  version?: string;
  until?: Stage;
  noBatch?: boolean;
  deps?: string[];
  via?: Via;
  target?: string;
}

/** A plan: a recipe (named; managed when it comes from the config file) or an ad-hoc plan. */
export interface Plan {
  name?: string;
  failFast?: boolean;
  steps: PlanStep[];
  managed?: boolean;
}

/**
 * What to preview or start (POST /api/actions/preview, /api/actions): a one-click action (kind
 * and its fields), a recipe by name, or an ad-hoc plan.
 */
export interface ActionRequest {
  kind?: ActionKind;
  package?: string;
  bump?: string; // major | minor | patch
  version?: string;
  target?: string;
  recipe?: string;
  plan?: Plan;
}

/** One dependency range an update-deps step sets. */
export interface DepChange {
  package: string;
  name: string;
  version: string;
  from?: string;
  to: string;
}

export type StepState =
  | 'waiting' | 'ready' | 'blocked' | 'triggering' | 'running' | 'paused' | 'done' | 'failed' | 'skipped' | 'cancelled';
export type RunState = 'running' | 'done' | 'failed' | 'cancelled';

export interface Step {
  key: string;
  type: StepType;
  package: string;
  bump?: string;
  version?: string;
  from?: string;
  tag?: string;
  target?: string;
  until?: Stage;
  branch?: string;
  commit?: string;
  needs?: string[];
  noBatch?: boolean;
  via?: Via;
  file?: string;
  deps?: DepChange[];
  pr?: number;
  attempt?: number;
  adopted?: boolean;
  state: StepState;
  detail?: string;
  url?: string;
  fired?: string;
  finished?: string;
}

export interface StepPreview extends Step {
  action: string;
  major?: boolean;
  unreleased?: number;
  waits?: string[];
}

export interface Preview {
  request: ActionRequest;
  title: string;
  recipe?: string;
  failFast?: boolean;
  plan?: Plan;
  steps: StepPreview[];
  errors: string[];
  warnings: string[];
  major: boolean;
  fingerprint: string;
}

export interface Run {
  id: number;
  title: string;
  state: RunState;
  source: string;
  actor: string;
  recipe?: string;
  failFast?: boolean;
  plan?: Plan;
  created: string;
  finished?: string;
  steps: Step[];
}

/** One server-sent event (/api/events): what changed. */
export interface Notice {
  packages: string[];
  runs?: number[];
}
