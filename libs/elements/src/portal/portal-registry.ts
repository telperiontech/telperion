import type { PortalElement } from "./portal-element";
import type { PortalOutletElement } from "./portal-outlet-element";
import { SYNC_PORTAL } from "./internal-props";

/**
 * Module-level name → outlet/portal bookkeeping.
 *
 * - Several outlets may share a name; the **most recently connected** one is
 *   active, and the previous one takes over when it disconnects.
 * - Several portals may share a name; all of them project into the active
 *   outlet, in connection order.
 */
class PortalRegistry {
  readonly #outlets = new Map<string, PortalOutletElement[]>();
  readonly #portals = new Map<string, Set<PortalElement>>();

  outletFor(name: string): PortalOutletElement | null {
    const stack = this.#outlets.get(name);
    return stack?.[stack.length - 1] ?? null;
  }

  addOutlet(name: string, outlet: PortalOutletElement): void {
    const stack = this.#outlets.get(name) ?? [];
    if (!stack.includes(outlet)) stack.push(outlet);
    this.#outlets.set(name, stack);
    this.#sync(name);
  }

  removeOutlet(name: string, outlet: PortalOutletElement): void {
    const stack = this.#outlets.get(name);
    if (!stack) return;
    const index = stack.indexOf(outlet);
    if (index === -1) return;
    stack.splice(index, 1);
    if (!stack.length) this.#outlets.delete(name);
    this.#sync(name);
  }

  addPortal(name: string, portal: PortalElement): void {
    const set = this.#portals.get(name) ?? new Set();
    set.add(portal);
    this.#portals.set(name, set);
    portal[SYNC_PORTAL]();
  }

  removePortal(name: string, portal: PortalElement): void {
    const set = this.#portals.get(name);
    if (!set) return;
    set.delete(portal);
    if (!set.size) this.#portals.delete(name);
  }

  #sync(name: string): void {
    for (const portal of [...(this.#portals.get(name) ?? [])]) portal[SYNC_PORTAL]();
  }
}

export const portalRegistry = new PortalRegistry();
