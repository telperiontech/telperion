import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * React 18 renders into `<tp-portal>` as an ordinary host parent and keeps
 * reconciling it after the children moved to the outlet.
 */
describe("<tp-portal> with React", () => {
  let container: HTMLElement;
  let root: Root;
  let setItems: (items: string[]) => void = () => undefined;
  let setShowPortal: (show: boolean) => void = () => undefined;
  let setShowOutlet: (show: boolean) => void = () => undefined;
  const onClick = vi.fn();

  function App(): ReturnType<typeof h> {
    const [items, _setItems] = useState(["a", "b"]);
    const [showPortal, _setShowPortal] = useState(true);
    const [showOutlet, _setShowOutlet] = useState(true);
    setItems = _setItems;
    setShowPortal = _setShowPortal;
    setShowOutlet = _setShowOutlet;

    return h(
      "div",
      null,
      showPortal &&
        h(
          "tp-portal",
          { name: "react" },
          items.map((item) => h("button", { key: item, id: item, onClick: () => onClick(item) }, item)),
          h("span", { id: "count" }, `count: ${items.length}`),
        ),
      h("main", null, showOutlet && h("tp-portal-outlet", { name: "react" })),
    );
  }

  const outlet = (): Element | null => container.querySelector("tp-portal-outlet");
  const ids = (): string[] => Array.from(outlet()?.querySelectorAll("button") ?? []).map((b) => b.id);

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(h(App)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    onClick.mockReset();
  });

  it("renders React children in the outlet and keeps React event handlers", () => {
    expect(ids()).toEqual(["a", "b"]);
    act(() => (outlet()!.querySelector("#b") as HTMLElement).click());
    expect(onClick).toHaveBeenCalledWith("b");
  });

  it("reconciles inserts, reorders, removals and text updates without throwing", () => {
    act(() => setItems(["c", "b", "a", "d"]));
    expect(ids()).toEqual(["c", "b", "a", "d"]);
    act(() => setItems(["d"]));
    expect(ids()).toEqual(["d"]);
    expect(outlet()!.querySelector("#count")!.textContent).toBe("count: 1");
  });

  it("unmounting the portal removes its content from the outlet", () => {
    act(() => setShowPortal(false));
    expect(outlet()!.querySelector("button")).toBeNull();
  });

  it("survives the outlet unmounting and remounting", () => {
    act(() => setShowOutlet(false));
    act(() => setItems(["x"]));
    expect(container.querySelector("tp-portal #x")).not.toBeNull();

    act(() => setShowOutlet(true));
    expect(ids()).toEqual(["x"]);
  });
});
