import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultRouteSourceLoader,
  parseRouteHtml,
  resolveRouteSrc,
  RouteSource,
} from "./route-source";

interface Deferred {
  resolve(html: string): void;
  reject(error: unknown): void;
  signal: AbortSignal;
}

/** A loader whose requests are settled manually by the test. */
function manualLoader() {
  const requests: Deferred[] = [];
  const loader = vi.fn((_url: string, signal: AbortSignal) => new Promise<string>((resolve, reject) => {
    requests.push({ resolve, reject, signal });
  }));

  return { loader, requests };
}

describe("resolveRouteSrc", () => {
  it("resolves relative URLs against the given base", () => {
    expect(resolveRouteSrc("partials/a.html", "https://example.com/app/")).toBe("https://example.com/app/partials/a.html");
    expect(resolveRouteSrc("/a.html", "https://example.com/app/")).toBe("https://example.com/a.html");
  });

  it("keeps absolute URLs", () => {
    expect(resolveRouteSrc("https://cdn.example.com/a.html", "https://example.com/")).toBe("https://cdn.example.com/a.html");
  });
});

describe("parseRouteHtml", () => {
  it("parses markup into a fragment", () => {
    const fragment = parseRouteHtml("<h1>Title</h1> text");

    expect(fragment.querySelector("h1")?.textContent).toBe("Title");
    expect(fragment.childNodes).toHaveLength(2);
  });

  it("drops document wrappers", () => {
    const fragment = parseRouteHtml("<!doctype html><html><head><title>x</title></head><body><p>Body</p></body></html>");

    expect(fragment.querySelector("html, head, body")).toBeNull();
    expect(fragment.querySelector("p")?.textContent).toBe("Body");
  });
});

describe("defaultRouteSourceLoader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the response text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<p>ok</p>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { signal } = new AbortController();

    await expect(defaultRouteSourceLoader("https://example.com/a.html", signal)).resolves.toBe("<p>ok</p>");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/a.html", { signal });
  });

  it("rejects on non-2xx responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404, statusText: "Not Found" })));

    await expect(defaultRouteSourceLoader("https://example.com/a.html", new AbortController().signal))
      .rejects.toThrow(/404 Not Found/);
  });
});

describe("RouteSource", () => {
  const URL_A = "https://example.com/a.html";
  const URL_B = "https://example.com/b.html";

  it("starts without a source", () => {
    const source = new RouteSource();

    expect(source.state.get()).toMatchObject({ status: "none", url: null });
  });

  it("is idle after a URL is set, without requesting it", () => {
    const { loader } = manualLoader();
    const source = new RouteSource();

    source.setUrl(URL_A);

    expect(source.state.get()).toMatchObject({ status: "idle", url: URL_A });
    expect(loader).not.toHaveBeenCalled();
  });

  it("loads, parses and caches the content", async () => {
    const { loader, requests } = manualLoader();
    const onChange = vi.fn();
    const source = new RouteSource(onChange);

    source.setUrl(URL_A);

    const pending = source.load(loader);

    expect(source.state.get().status).toBe("loading");
    expect(loader).toHaveBeenCalledWith(URL_A, expect.any(AbortSignal));

    requests[0].resolve("<p>A</p>");
    await pending;

    const state = source.state.get();
    expect(state.status).toBe("loaded");
    expect(state.fragment?.querySelector("p")?.textContent).toBe("A");
    expect(onChange.mock.calls.map(([s]) => s.status)).toEqual(["idle", "loading", "loaded"]);

    await source.load(loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("shares the in-flight request between concurrent loads", async () => {
    const { loader, requests } = manualLoader();
    const source = new RouteSource();

    source.setUrl(URL_A);

    const first = source.load(loader);
    const second = source.load(loader);

    expect(second).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);

    requests[0].resolve("A");
    await Promise.all([first, second]);
    expect(source.state.get().status).toBe("loaded");
  });

  it("reports failures without caching them", async () => {
    const { loader, requests } = manualLoader();
    const source = new RouteSource();
    const error = new Error("boom");

    source.setUrl(URL_A);

    const pending = source.load(loader);
    requests[0].reject(error);
    await pending;

    expect(source.state.get()).toMatchObject({ status: "error", error });

    const retry = source.load(loader);
    expect(loader).toHaveBeenCalledTimes(2);
    requests[1].resolve("A");
    await retry;
    expect(source.state.get().status).toBe("loaded");
  });

  it("aborts and ignores a superseded request when the URL changes", async () => {
    const { loader, requests } = manualLoader();
    const source = new RouteSource();

    source.setUrl(URL_A);

    const first = source.load(loader);
    source.setUrl(URL_B);

    expect(requests[0].signal.aborted).toBe(true);
    expect(source.state.get()).toMatchObject({ status: "idle", url: URL_B });

    const second = source.load(loader);
    requests[0].resolve("<p>A</p>");
    await first;
    expect(source.state.get().status).toBe("loading");

    requests[1].resolve("<p>B</p>");
    await second;
    expect(source.state.get().fragment?.textContent).toBe("B");
  });

  it("drops cached content when the URL changes", async () => {
    const { loader, requests } = manualLoader();
    const source = new RouteSource();

    source.setUrl(URL_A);

    const pending = source.load(loader);
    requests[0].resolve("A");
    await pending;

    source.setUrl(URL_B);
    expect(source.state.get()).toMatchObject({ status: "idle", fragment: null });

    source.setUrl(null);
    expect(source.state.get().status).toBe("none");
  });

  it("ignores setting the same URL", () => {
    const onChange = vi.fn();
    const source = new RouteSource(onChange);

    source.setUrl(URL_A);
    source.setUrl(URL_A);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("abort() cancels the in-flight request and returns to idle", async () => {
    const { loader, requests } = manualLoader();
    const source = new RouteSource();

    source.setUrl(URL_A);

    const pending = source.load(loader);
    source.abort();

    expect(requests[0].signal.aborted).toBe(true);
    expect(source.state.get().status).toBe("idle");

    requests[0].resolve("A");
    await pending;
    expect(source.state.get().status).toBe("idle");
  });

  it("abort() keeps already loaded content", async () => {
    const { loader, requests } = manualLoader();
    const source = new RouteSource();

    source.setUrl(URL_A);

    const pending = source.load(loader);
    requests[0].resolve("A");
    await pending;

    source.abort();
    expect(source.state.get().status).toBe("loaded");
  });
});
