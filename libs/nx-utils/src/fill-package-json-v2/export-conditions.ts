/**
 * Canonical ordering for conditional `exports` keys.
 *
 * Node, TypeScript and bundlers walk a conditions object in insertion order
 * and pick the FIRST key that matches the active conditions. So:
 *
 * - `types` must come first, or TypeScript may resolve a JS file instead.
 * - `import` / `require` must precede `node`: Node activates `node` for both
 *   ESM and CJS consumers, so a leading `node` → `.cjs` hands CommonJS to ESM
 *   importers.
 * - `default` must come last: it always matches and shadows everything after.
 */
export const EXPORT_CONDITION_ORDER = [
  'types',
  'import',
  'require',
  'browser',
  'node',
  'script',
  'default',
] as const;

export type OrderedExportCondition = (typeof EXPORT_CONDITION_ORDER)[number];

/** Return `conditions` de-duplicated and sorted into {@link EXPORT_CONDITION_ORDER}. */
export function orderConditions<T extends string>(conditions: readonly T[]): T[] {
  const known = EXPORT_CONDITION_ORDER as readonly string[];
  return known.filter((c) => conditions.includes(c as T)) as T[];
}

type ConditionsObject = Record<string, unknown>;

function isObject(value: unknown): value is ConditionsObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkConditions(path: string, conditions: ConditionsObject, isEntry: boolean): string[] {
  const keys = Object.keys(conditions);
  const errors: string[] = [];

  if (keys.includes('types') && keys[0] !== 'types') {
    errors.push(`${path}: "types" must be the first condition (got ${JSON.stringify(keys)})`);
  }
  if (isEntry && !keys.includes('types') && (keys.includes('import') || keys.includes('require'))) {
    errors.push(`${path}: JS entry has no "types" condition (got ${JSON.stringify(keys)})`);
  }
  if (keys.includes('default') && keys[keys.length - 1] !== 'default') {
    errors.push(`${path}: "default" must be the last condition (got ${JSON.stringify(keys)})`);
  }
  const nodeIndex = keys.indexOf('node');
  if (nodeIndex !== -1) {
    for (const cond of ['import', 'require']) {
      const i = keys.indexOf(cond);
      if (i > nodeIndex) {
        errors.push(`${path}: "${cond}" must come before "node" (got ${JSON.stringify(keys)})`);
      }
    }
  }

  for (const key of keys) {
    const value = conditions[key];
    if (isObject(value)) errors.push(...checkConditions(`${path}.${key}`, value, false));
  }

  return errors;
}

/**
 * Validate a package.json `exports` value. Returns a human-readable list of
 * ordering violations; an empty array means the map is valid.
 */
export function findExportsOrderViolations(exports: unknown): string[] {
  if (!isObject(exports)) return [];

  const keys = Object.keys(exports);
  const isSubpathMap = keys.length > 0 && keys.every((k) => k.startsWith('.'));
  if (!isSubpathMap) return checkConditions('exports', exports, true);

  const errors: string[] = [];
  for (const subpath of keys) {
    const entry = exports[subpath];
    if (isObject(entry)) errors.push(...checkConditions(`exports["${subpath}"]`, entry, true));
  }
  return errors;
}
