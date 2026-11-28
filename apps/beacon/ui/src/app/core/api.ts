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

/** A one-click action (POST /api/actions/preview, /api/actions). */
export interface ActionRequest {
  kind: ActionKind;
  package: string;
  bump?: string; // major | minor | patch
  version?: string;
  target?: string;
}

export type StepState =
  | 'waiting' | 'ready' | 'blocked' | 'triggering' | 'running' | 'done' | 'failed' | 'skipped' | 'cancelled';
export type RunState = 'running' | 'done' | 'failed' | 'cancelled';

export interface Step {
  key: string;
  type: ActionKind;
  package: string;
  bump?: string;
  version: string;
  from?: string;
  tag?: string;
  target?: string;
  until?: Stage;
  branch?: string;
  commit?: string;
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
  created: string;
  finished?: string;
  steps: Step[];
}

/** One server-sent event (/api/events): what changed. */
export interface Notice {
  packages: string[];
  runs?: number[];
}
