/** Registry → portal: re-resolve the active outlet and (re)project into it. */
export const SYNC_PORTAL = Symbol("portal:sync");
/** Portal → outlet: a portal started projecting into the outlet. */
export const ATTACH_PORTAL = Symbol("portal-outlet:attach");
/** Portal → outlet: a portal stopped projecting into the outlet. */
export const DETACH_PORTAL = Symbol("portal-outlet:detach");
