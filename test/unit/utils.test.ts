import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("returns a single class unchanged", () => {
    expect(cn("px-4")).toBe("px-4");
  });

  it("merges multiple independent classes", () => {
    expect(cn("px-4", "py-2", "text-white")).toBe("px-4 py-2 text-white");
  });

  it("last conflicting Tailwind class wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("resolves conflicting text-color utilities — last wins", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("custom font-size tokens conflict with each other — last wins", () => {
    expect(cn("text-heading", "text-body")).toBe("text-body");
  });

  it("text-white is NOT dropped when combined with a custom font-size token", () => {
    const result = cn("text-body", "text-white");
    expect(result).toContain("text-body");
    expect(result).toContain("text-white");
  });

  it("core font-size and custom font-size token conflict — last wins", () => {
    expect(cn("text-sm", "text-body")).toBe("text-body");
    expect(cn("text-body", "text-sm")).toBe("text-sm");
  });

  it("ignores falsy values", () => {
    expect(cn("px-4", null, undefined, false, "py-2")).toBe("px-4 py-2");
  });

  it("returns empty string for all-falsy input", () => {
    expect(cn(null, undefined, false)).toBe("");
  });

  it("handles conditional classes via object syntax", () => {
    expect(cn({ "font-bold": true, "italic": false })).toBe("font-bold");
  });
});
