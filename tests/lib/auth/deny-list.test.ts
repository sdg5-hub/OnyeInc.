import { beforeEach, describe, expect, it } from "vitest";

import { addToDenyList, clearDenyList, isDenied } from "@/lib/auth/deny-list";

beforeEach(() => {
  clearDenyList();
});

describe("deny-list", () => {
  it("reports a token as not denied before it's added", () => {
    expect(isDenied("some-token")).toBe(false);
  });

  it("reports a token as denied once it's added", () => {
    addToDenyList("revoked-token");
    expect(isDenied("revoked-token")).toBe(true);
  });

  it("leaves other tokens unaffected when one is denied", () => {
    addToDenyList("token-a");
    expect(isDenied("token-a")).toBe(true);
    expect(isDenied("token-b")).toBe(false);
  });

  it("clears all entries on clearDenyList", () => {
    addToDenyList("token-a");
    addToDenyList("token-b");
    clearDenyList();
    expect(isDenied("token-a")).toBe(false);
    expect(isDenied("token-b")).toBe(false);
  });
});
