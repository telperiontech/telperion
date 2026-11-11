import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FRAGMENT, RouteElement, SET_ACTIVE, SOURCE_STATUS } from "./route-element";
import { ROUTE_ERROR_EVENT, ROUTE_LOAD_EVENT, RouteSourceEvent } from "./route-events";

const SRC = "https://example.com/partials/page.html";

interface Request {
  url: string;
  signal: AbortSignal;
  resolve(html: string): void;
  reject(error: unknown): void;
}

function makeRoute(html: string, src: string | null = SRC) {
  document.body.innerHTML = `<tp-route${src ? ` src="${src}"` : ""}>${html}</tp-route>`;

  const route = document.querySelector("tp-route") as RouteElement;
  const requests: Request[] = [];

  route.loader = vi.fn((url: string, signal: AbortSignal) => new Promise<string>((resolve, reject) => {
    requests.push({ url, signal, resolve, reject });
  }));

  return { route, requests };
}

/** Lets pending promise callbacks and Lit updates run. */
async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

function text(fragment: DocumentFragment | null): string | undefined {
  return fragment?.textContent?.trim();
}

describe("<tp-route src>", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("registers the custom element", () => {
    expect(customElements.get("tp-route")).toBe(RouteElement);
  });

  it("uses the inline template when there is no src", () => {
    const { route } = makeRoute("<template><p>Inline</p></template>", null);

    expect(text(route[FRAGMENT].get())).toBe("Inline");
    expect(route[SOURCE_STATUS].get()).toBe("none");
  });

  it("does not request the src until activated", () => {
    const { route } = makeRoute("");

    expect(route.loader).not.toHaveBeenCalled();
    expect(route[SOURCE_STATUS].get()).toBe("idle");
  });

  it("renders the loading template, then the fetched content", async () => {
    const { route, requests } = makeRoute(
      `<template><p>Inline</p></template><template data-loading><p>Loading</p></template>`,
    );
    const onLoad = vi.fn((_event: RouteSourceEvent) => undefined);
    route.addEventListener(ROUTE_LOAD_EVENT, onLoad);

    route[SET_ACTIVE](true);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(SRC);
    expect(route.hasAttribute("loading")).toBe(true);
    expect(text(route[FRAGMENT].get())).toBe("Loading");

    requests[0].resolve("<h1>Remote</h1>");
    await flush();

    expect(text(route[FRAGMENT].get())).toBe("Remote");
    expect(route.hasAttribute("loading")).toBe(false);
    expect(route.hasAttribute("loaded")).toBe(true);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad.mock.calls[0][0].detail).toEqual({ src: SRC });
  });

  it("renders nothing while loading when there is no loading template", () => {
    const { route } = makeRoute("<template><p>Inline</p></template>");

    route[SET_ACTIVE](true);

    expect(route[FRAGMENT].get()).toBeNull();
  });

  it("caches the content across activations", async () => {
    const { route, requests } = makeRoute("");

    route[SET_ACTIVE](true);
    requests[0].resolve("<p>Remote</p>");
    await flush();

    route[SET_ACTIVE](false);
    route[SET_ACTIVE](true);

    expect(route.loader).toHaveBeenCalledTimes(1);
    expect(text(route[FRAGMENT].get())).toBe("Remote");
  });

  it("renders the error template, fires an event and retries on the next activation", async () => {
    const { route, requests } = makeRoute(`<template data-error><p>Failed</p></template>`);
    const onError = vi.fn((_event: RouteSourceEvent) => undefined);
    const error = new Error("boom");
    route.addEventListener(ROUTE_ERROR_EVENT, onError);

    route[SET_ACTIVE](true);
    requests[0].reject(error);
    await flush();

    expect(route.hasAttribute("error")).toBe(true);
    expect(text(route[FRAGMENT].get())).toBe("Failed");
    expect(onError.mock.calls[0][0].detail).toEqual({ src: SRC, error });

    route[SET_ACTIVE](true);
    expect(route.loader).toHaveBeenCalledTimes(2);
    expect(route.hasAttribute("loading")).toBe(true);
  });

  it("reloads when src changes while active", async () => {
    const { route, requests } = makeRoute("");

    route[SET_ACTIVE](true);
    route.setAttribute("src", "https://example.com/other.html");
    await route.updateComplete;

    expect(requests[0].signal.aborted).toBe(true);
    expect(requests[1].url).toBe("https://example.com/other.html");
  });

  it("does not load a changed src while inactive", async () => {
    const { route } = makeRoute("");

    route.src = "https://example.com/other.html";
    await route.updateComplete;

    expect(route.loader).not.toHaveBeenCalled();
  });

  it("aborts the request on disconnect and resumes on reconnect", () => {
    const { route, requests } = makeRoute("");

    route[SET_ACTIVE](true);
    route.remove();

    expect(requests[0].signal.aborted).toBe(true);
    expect(route.hasAttribute("loading")).toBe(false);

    document.body.appendChild(route);
    expect(requests).toHaveLength(2);
  });

  it("resolves a relative src against the document base URL", () => {
    const { route, requests } = makeRoute("", "partials/relative.html");

    route[SET_ACTIVE](true);

    expect(requests[0].url).toBe(new URL("partials/relative.html", document.baseURI).href);
  });
});
