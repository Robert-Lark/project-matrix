// Slug rules (ADR-0009 §6) + upload-time dimension sniffing.
import { describe, expect, it } from "vitest";
import { validSlug } from "../src/db.js";
import { imageDimensions } from "../src/dimensions.js";

describe("validSlug", () => {
  it("accepts flat kebab slugs", () => {
    expect(validSlug("hello-world")).toBe(true);
    expect(validSlug("a")).toBe(true);
    expect(validSlug("post-2026")).toBe(true);
  });

  it("refuses reserved route names", () => {
    for (const reserved of ["admin", "static", "media", "tag", "series", "preview", "api", "feed", "rss"]) {
      expect(validSlug(reserved)).toBe(false);
    }
  });

  it("refuses shapes that would break URLs", () => {
    expect(validSlug("")).toBe(false);
    expect(validSlug("Has-Caps")).toBe(false);
    expect(validSlug("two--dashes")).toBe(false);
    expect(validSlug("-leading")).toBe(false);
    expect(validSlug("trailing-")).toBe(false);
    expect(validSlug("with/slash")).toBe(false);
    expect(validSlug("with.dot")).toBe(false);
    expect(validSlug("x".repeat(97))).toBe(false);
  });
});

describe("imageDimensions", () => {
  it("reads PNG IHDR", () => {
    const png = Uint8Array.from(atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    ), (c) => c.charCodeAt(0));
    expect(imageDimensions(png)).toEqual({ width: 1, height: 1 });
  });

  it("reads GIF logical screen descriptor", () => {
    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      0x05, 0x00, 0x03, 0x00, // 5 × 3 little-endian
      0x00, 0x00, 0x00,
    ]);
    expect(imageDimensions(gif)).toEqual({ width: 5, height: 3 });
  });

  it("reads JPEG SOF0", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xc0, 0x00, 0x0b, 0x08, // SOF0, length 11, precision
      0x00, 0x02, // height 2
      0x00, 0x03, // width 3
      0x01, 0xff, 0xd9,
    ]);
    expect(imageDimensions(jpeg)).toEqual({ width: 3, height: 2 });
  });

  it("returns null for unknown bytes", () => {
    expect(imageDimensions(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
  });
});
