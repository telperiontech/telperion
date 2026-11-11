import { signal } from "@lit-labs/signals";

/**
 * Fetches the raw HTML of a route's `src`.
 *
 * Must reject on failure (network error, non-2xx status, …) and should honour
 * `signal` so superseded requests can be cancelled.
 */
export type RouteSourceLoader = (url: string, signal: AbortSignal) => Promise<string>;

/**
 * Lifecycle of a route's remote content.
 *
 * - `none`: the route has no `src`; its inline `<template>` is used.
 * - `idle`: a `src` is set but has not been requested yet.
 * - `loading`: the request is in flight.
 * - `loaded`: the content was fetched and parsed.
 * - `error`: the last request failed; the next activation retries.
 */
export type RouteSourceStatus = "none" | "idle" | "loading" | "loaded" | "error";

/** Snapshot of a {@link RouteSource}. */
export interface RouteSourceState {
  status: RouteSourceStatus;
  /** Absolute URL of the content, or `null` when the route has no `src`. */
  url: string | null;
  /** Parsed content, only set when `status` is `loaded`. */
  fragment: DocumentFragment | null;
  /** Failure reason, only set when `status` is `error`. */
  error: unknown;
}

const NO_SOURCE: RouteSourceState = Object.freeze({ status: "none", url: null, fragment: null, error: null });

/**
 * Default {@link RouteSourceLoader}: a plain `fetch` that rejects on non-2xx
 * responses.
 */
export const defaultRouteSourceLoader: RouteSourceLoader = async (url, signal) => {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load route source "${url}": ${response.status} ${response.statusText}`);
  }

  return response.text();
};

/**
 * Resolves a `src` attribute value against the document base URL.
 */
export function resolveRouteSrc(src: string, base: string = document.baseURI): string {
  return new URL(src, base).href;
}

/**
 * Parses an HTML string into an inert `DocumentFragment`.
 *
 * Parsing goes through a detached `<template>`, so `<script>` elements are
 * never executed (not even when the fragment is later cloned into the
 * document) and `<html>` / `<head>` / `<body>` wrappers are dropped.
 */
export function parseRouteHtml(html: string): DocumentFragment {
  const template = document.createElement("template");

  template.innerHTML = html;

  return template.content;
}

/**
 * Loads, parses and caches the remote content of a single route.
 *
 * - Content is requested once per URL and cached until the URL changes.
 * - Concurrent {@link load} calls share the in-flight request.
 * - Changing the URL or calling {@link abort} cancels the in-flight request;
 *   late responses for a superseded request are ignored.
 * - Failures are not cached: the next {@link load} retries.
 */
export class RouteSource {
  /** Reactive snapshot of the current state. */
  readonly state = signal<RouteSourceState>(NO_SOURCE);

  #controller: AbortController | null = null;
  #pending: Promise<void> | null = null;
  #onChange: (state: RouteSourceState) => void;

  /**
   * @param onChange - Called synchronously after every state transition.
   */
  constructor(onChange: (state: RouteSourceState) => void = () => undefined) {
    this.#onChange = onChange;
  }

  /** Current absolute URL, or `null` when the route has no `src`. */
  get url(): string | null {
    return this.state.get().url;
  }

  /**
   * Points the source at a new URL. A no-op when the URL is unchanged;
   * otherwise any in-flight request is cancelled and the cache is dropped.
   */
  setUrl(url: string | null): void {
    if (url === this.url) return;

    this.#cancel();
    this.#set(url ? { status: "idle", url, fragment: null, error: null } : NO_SOURCE);
  }

  /**
   * Ensures the content for the current URL is loaded.
   *
   * @returns A promise that settles once the content is loaded or failed.
   *          It never rejects; failures are reported through {@link state}.
   */
  load(loader: RouteSourceLoader): Promise<void> {
    const { status, url } = this.state.get();

    if (!url || status === "loaded") return Promise.resolve();

    if (this.#pending) return this.#pending;

    const controller = new AbortController();

    this.#controller = controller;
    this.#set({ status: "loading", url, fragment: null, error: null });

    const pending = this.#request(loader, url, controller).finally(() => {
      if (this.#controller !== controller) return;

      this.#controller = null;
      this.#pending = null;
    });

    this.#pending = pending;

    return pending;
  }

  /**
   * Cancels the in-flight request, if any. Already loaded content is kept.
   */
  abort(): void {
    if (!this.#controller) return;

    const { url } = this.state.get();

    this.#cancel();
    this.#set({ status: "idle", url, fragment: null, error: null });
  }

  async #request(loader: RouteSourceLoader, url: string, controller: AbortController): Promise<void> {
    try {
      const html = await loader(url, controller.signal);

      if (controller.signal.aborted) return;

      this.#set({ status: "loaded", url, fragment: parseRouteHtml(html), error: null });
    } catch (error) {
      if (controller.signal.aborted) return;

      this.#set({ status: "error", url, fragment: null, error });
    }
  }

  #cancel(): void {
    this.#controller?.abort();
    this.#controller = null;
    this.#pending = null;
  }

  #set(state: RouteSourceState): void {
    this.state.set(state);
    this.#onChange(state);
  }
}
