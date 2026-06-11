import { describe, expect, it } from "vitest";

import { isPdfBuffer } from "@/lib/validation/pdf";

const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

describe("isPdfBuffer()", () => {
  it("returns true for a valid PDF magic number", () => {
    const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it("returns true when extra bytes follow the magic number", () => {
    const buf = new Uint8Array([...PDF_HEADER, 0x00, 0x00, 0xff]);
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it("returns false for a JPEG buffer (FF D8 FF ...)", () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(isPdfBuffer(buf)).toBe(false);
  });

  it("returns false for a PNG buffer (89 50 4E 47 ...)", () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(isPdfBuffer(buf)).toBe(false);
  });

  it("returns false for an empty buffer", () => {
    expect(isPdfBuffer(new Uint8Array([]))).toBe(false);
  });

  it("returns false for a buffer shorter than 4 bytes", () => {
    expect(isPdfBuffer(new Uint8Array([0x25, 0x50, 0x44]))).toBe(false);
  });

  it("returns false when only first byte matches", () => {
    expect(isPdfBuffer(new Uint8Array([0x25, 0x00, 0x00, 0x00]))).toBe(false);
  });

  it("is case-sensitive — lowercase pdf bytes are rejected", () => {
    // 0x70=p 0x64=d 0x66=f (lowercase)
    const buf = new Uint8Array([0x25, 0x70, 0x64, 0x66]);
    expect(isPdfBuffer(buf)).toBe(false);
  });
});
