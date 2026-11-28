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
