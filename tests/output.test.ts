import { describe, it, expect } from "vitest";
import {
  resolveOutputMode,
  renderTable,
  renderKeyValue,
} from "../src/output.js";

describe("resolveOutputMode", () => {
  it("returns json when --json is set, table otherwise", () => {
    expect(resolveOutputMode({ json: true })).toBe("json");
    expect(resolveOutputMode({ json: false })).toBe("table");
    expect(resolveOutputMode({})).toBe("table");
  });
});

describe("renderTable", () => {
  it("includes headers, cell values, and footer", () => {
    const out = renderTable(
      ["EVENT", "N"],
      [
        ["pageview", 1420],
        ["click", 318],
      ],
      "2 rows"
    );
    expect(out).toContain("EVENT");
    expect(out).toContain("pageview");
    expect(out).toContain("1420");
    expect(out).toContain("2 rows");
  });

  it("renders null/undefined cells as a dash", () => {
    const out = renderTable(["A"], [[null]]);
    expect(out).toContain("—");
  });
});

describe("renderKeyValue", () => {
  it("renders each pair", () => {
    const out = renderKeyValue([
      ["Project", "proj-123"],
      ["Scope", "api"],
    ]);
    expect(out).toContain("Project");
    expect(out).toContain("proj-123");
    expect(out).toContain("Scope");
    expect(out).toContain("api");
  });
});
