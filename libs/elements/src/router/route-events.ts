/** Fired on a `<tp-route>` when its `src` content has loaded. Bubbles and is composed. */
export const ROUTE_LOAD_EVENT = "tp-route-load";
/** Fired on a `<tp-route>` when its `src` content failed to load. Bubbles and is composed. */
export const ROUTE_ERROR_EVENT = "tp-route-error";

/** `detail` of {@link ROUTE_LOAD_EVENT} and {@link ROUTE_ERROR_EVENT}. */
export interface RouteSourceEventDetail {
  /** Absolute URL that was requested. */
  src: string;
  /** Failure reason; only present on {@link ROUTE_ERROR_EVENT}. */
  error?: unknown;
}

export type RouteSourceEvent = CustomEvent<RouteSourceEventDetail>;

declare global {
  interface HTMLElementEventMap {
    [ROUTE_LOAD_EVENT]: RouteSourceEvent;
    [ROUTE_ERROR_EVENT]: RouteSourceEvent;
  }
}

export function createRouteSourceEvent(
  type: typeof ROUTE_LOAD_EVENT | typeof ROUTE_ERROR_EVENT,
  detail: RouteSourceEventDetail,
): RouteSourceEvent {
  return new CustomEvent(type, { detail, bubbles: true, composed: true });
}
