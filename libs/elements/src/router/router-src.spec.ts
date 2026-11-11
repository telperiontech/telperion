import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getHistoryByType } from "./history";
import type { RouteElement } from "./route-element";
import type { RouterOutletElement } from "./router-outlet-element";
import "./router-element";
import "./route-element";
import "./router-outlet-element";

// jsdom lacks document.adoptedStyleSheets, which SignalWatcherLitElement's base touches at import time
vi.hoisted(() => {
  if (!document.adoptedStyleSheets) {
    Object.defineProperty(document, "adoptedStyleSheets", { value: [], writable: true, configurable: true });
  }
});

/** Minimal URLPattern stand-in: exact pathname match, `*` matches anything. */
class FakeURLPattern {
  #pathname: string;

  constructor({ pathname }: { pathname: string }) {
    this.#pathname = pathname;
  }

  test({ pathname }: { pathname: string }): boolean {
    return this.#pathname === "*" || this.#pathname === pathname;
  }

  exec(input: string, base?: string) {
    return this.test({ pathname: new URL(input, base).pathname }) ? { pathname: { groups: {} } } : null;
  }
}

const HISTORY = "memory:router-src-spec";

async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function setup() {
  const history = getHistoryByType(HISTORY);
  history.replace("/");

  document.body.innerHTML = `<tp-router history="${HISTORY}"></tp-router>`;

  const router = document.querySelector("tp-router")!;

  // Routes are discovered through a childList mutation, so add them after connect
  router.innerHTML = `
    <tp-route path="/"><template><p>Home</p></template></tp-route>
    <tp-route path="/remote" src="https://example.com/remote.html">
      <template data-loading><p>Loading</p></template>
      <template data-error><p>Failed</p></template>
    </tp-route>
    <tp-router-outlet></tp-router-outlet>
  `;

  const remote = router.querySelector<RouteElement>('tp-route[path="/remote"]')!;
  const outlet = router.querySelector<RouterOutletElement>("tp-router-outlet")!;
  const resolvers: Array<(html: string) => void> = [];
  const rejecters: Array<(error: unknown) => void> = [];

  remote.loader = vi.fn(() => new Promise<string>((resolve, reject) => {
    resolvers.push(resolve);
    rejecters.push(reject);
  }));

  await flush();
  await flush();

  return { history, remote, outlet, resolvers, rejecters };
}

function outletText(outlet: Element): string {
  return outlet.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

describe("<tp-router> with <tp-route src>", () => {
  beforeAll(() => {
    vi.stubGlobal("URLPattern", FakeURLPattern);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not request the src before the route matches", async () => {
    const { outlet, remote } = await setup();

    expect(outletText(outlet)).toBe("Home");
    expect(remote.loader).not.toHaveBeenCalled();
  });

  it("shows the loading template, then the remote content", async () => {
    const { history, outlet, resolvers } = await setup();

    history.push("/remote");
    await flush();

    expect(outletText(outlet)).toBe("Loading");
    expect(outlet.hasAttribute("route-loading")).toBe(true);

    resolvers[0]("Remote <strong>content</strong>");
    await flush();

    expect(outletText(outlet)).toBe("Remote content");
    expect(outlet.hasAttribute("route-loading")).toBe(false);
  });

  it("removes top-level text nodes when switching routes", async () => {
    const { history, outlet, resolvers } = await setup();

    history.push("/remote");
    resolvers[0]("loose text");
    await flush();
    expect(outletText(outlet)).toBe("loose text");

    history.push("/");
    await flush();
    expect(outletText(outlet)).toBe("Home");
  });

  it("fetches once across navigations", async () => {
    const { history, remote, outlet, resolvers } = await setup();

    history.push("/remote");
    resolvers[0]("Remote");
    await flush();

    history.push("/");
    await flush();
    history.push("/remote");
    await flush();

    expect(remote.loader).toHaveBeenCalledTimes(1);
    expect(outletText(outlet)).toBe("Remote");
  });

  it("shows the error template and mirrors route-error", async () => {
    const { history, outlet, rejecters } = await setup();

    history.push("/remote");
    rejecters[0](new Error("boom"));
    await flush();

    expect(outletText(outlet)).toBe("Failed");
    expect(outlet.hasAttribute("route-error")).toBe(true);
  });
});
