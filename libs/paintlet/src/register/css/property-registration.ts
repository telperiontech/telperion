import { CSSPropertyDefinition } from '../../paint.type';

/**
 * Registers custom properties globally via `CSS.registerProperty()`.
 *
 * Already-registered properties are skipped silently. Invalid definitions are
 * reported and skipped so one bad property does not block the others.
 */
export function registerProperties(properties: readonly CSSPropertyDefinition[]): void {
  if (typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') return;

  for (const property of properties) {
    try {
      CSS.registerProperty({
        name: property.name,
        syntax: property.syntax,
        inherits: property.inherits,
        initialValue: String(property.initialValue),
      });
    } catch (error) {
      if (isAlreadyRegistered(error)) continue;

      console.warn(`[@telperion/paintlet] Could not register custom property "${property.name}".`, error);
    }
  }
}

function isAlreadyRegistered(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'InvalidModificationError';
}
