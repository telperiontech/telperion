import { afterEach, describe, expect, it, vi } from "vitest";

import { themeConfig } from "./theme";

describe("themeConfig", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("maps the resolved --_tp-mermaid-* variables to Mermaid theme variables", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    const host = document.body.appendChild(document.createElement("div"));

    host.style.setProperty("--_tp-mermaid-foreground", "rgb(20, 20, 20)");
    host.style.setProperty("--_tp-mermaid-background", "rgb(10, 10, 10)");
    host.style.setProperty("--_tp-mermaid-line", "rgb(1, 2, 3)");

    const { theme, themeVariables } = themeConfig(host);

    expect(theme).toBe("base");
    expect(themeVariables.primaryTextColor).toBe("rgb(20, 20, 20)");
    expect(themeVariables.edgeLabelBackground).toBe("rgb(10, 10, 10)");
    expect(themeVariables.lineColor).toBe("rgb(1, 2, 3)");
    expect(themeVariables.darkMode).toBe(true);
  });

  it("leaves out variables that are not set", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    const host = document.body.appendChild(document.createElement("div"));
    const { themeVariables } = themeConfig(host);

    expect(themeVariables).not.toHaveProperty("primaryColor");
    expect(themeVariables).not.toHaveProperty("darkMode");
  });
});
