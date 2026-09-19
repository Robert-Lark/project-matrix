// Slug rules (ADR-0009 §6) + upload-time dimension sniffing + the STORE
// zip writer + export front-matter.
import { describe, expect, it } from "vitest";
import { postFrontMatter, validSlug } from "../src/db.js";
import { imageDimensions, sniffImage } from "../src/dimensions.js";
import { crc32, zipStore } from "../src/zip.js";

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

// The upload path keys the stored type off the sniffed bytes, never off the
// client's `file.type` (security floor, 2026-09-18). These legs hold the
// sniffer to the FORMAT half of that contract: the type it names is the type
// the magic bytes are, and bytes it cannot read are null — a 400 upstream.
describe("sniffImage: the type comes from the bytes", () => {
  const png = Uint8Array.from(atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ), (c) => c.charCodeAt(0));

  it("names PNG bytes image/png with their IHDR dimensions", () => {
    expect(sniffImage(png)).toEqual({ type: "image/png", width: 1, height: 1 });
  });

  it("names GIF bytes image/gif", () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x05, 0x00, 0x03, 0x00, 0, 0, 0]);
    expect(sniffImage(gif)).toEqual({ type: "image/gif", width: 5, height: 3 });
  });

  it("names JPEG bytes image/jpeg", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x03, 0x01, 0xff, 0xd9,
    ]);
    expect(sniffImage(jpeg)).toEqual({ type: "image/jpeg", width: 3, height: 2 });
  });

  it("names a RIFF/WEBP VP8 header image/webp", () => {
    const webp = new Uint8Array(30);
    const dv = new DataView(webp.buffer);
    dv.setUint32(0, 0x52494646); // RIFF
    dv.setUint32(4, 22, true); // riff size (ignored by the sniffer)
    dv.setUint32(8, 0x57454250); // WEBP
    dv.setUint32(12, 0x56503820); // "VP8 "
    dv.setUint16(26, 7, true); // width 7
    dv.setUint16(28, 4, true); // height 4
    expect(sniffImage(webp)).toEqual({ type: "image/webp", width: 7, height: 4 });
  });

  it("text bytes are null whatever the client declared — the 400 upstream", () => {
    const text = new TextEncoder().encode("hello, this is a text file pretending to be image/png\n");
    expect(sniffImage(text)).toBeNull();
  });

  it("a PNG signature with a truncated IHDR is null, not a guess", () => {
    expect(sniffImage(png.slice(0, 20))).toBeNull();
  });

  it("an unknown RIFF fourcc is null (RIFF alone is not WEBP)", () => {
    const riff = new Uint8Array(30);
    const dv = new DataView(riff.buffer);
    dv.setUint32(0, 0x52494646);
    dv.setUint32(8, 0x57415645); // WAVE
    expect(sniffImage(riff)).toBeNull();
  });

  it("imageDimensions is the same sniff without the type", () => {
    expect(imageDimensions(png)).toEqual({ width: 1, height: 1 });
  });

  // verify-slice, skeptic lens (2026-09-18): the sniff must read the WHOLE
  // signature and refuse an empty box, or "the type comes from the bytes"
  // is true of three bytes.
  it("a text file that merely starts with 'GIF' is not a GIF", () => {
    const text = new TextEncoder().encode("GIF is a format I like, honestly — this is prose\n");
    expect(sniffImage(text)).toBeNull();
  });

  it("GIF87a is accepted like GIF89a", () => {
    const gif87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x05, 0x00, 0x03, 0x00, 0, 0, 0]);
    expect(sniffImage(gif87)).toEqual({ type: "image/gif", width: 5, height: 3 });
  });

  const pngWith = (chunk, w, h) =>
    new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // the full 8-byte signature
      0, 0, 0, 13, ...chunk, // length 13 + chunk type
      (w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255,
      (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255,
      8, 6, 0, 0, 0,
    ]);
  const IHDR = [0x49, 0x48, 0x44, 0x52];

  it("a 0 × 0 PNG is not an image (a zero dimension is refused for every format)", () => {
    expect(sniffImage(pngWith(IHDR, 0, 0))).toBeNull();
    expect(sniffImage(pngWith(IHDR, 3, 0))).toBeNull();
    expect(sniffImage(pngWith(IHDR, 3, 2))).toEqual({ type: "image/png", width: 3, height: 2 });
  });

  it("a PNG signature whose first chunk is not IHDR is refused", () => {
    expect(sniffImage(pngWith([0x41, 0x42, 0x43, 0x44], 3, 2))).toBeNull();
  });

  it("the WHOLE 8-byte PNG signature is read — \\x89PNG with wrong bytes 4–7 is refused even with IHDR present", () => {
    const wrongTail = pngWith(IHDR, 3, 2);
    wrongTail.set([0x0d, 0x0a, 0x0d, 0x0a], 4); // CR LF CR LF instead of CR LF SUB LF
    expect(sniffImage(wrongTail)).toBeNull();
  });

  it("a JPEG with a 0xFF fill byte before its SOF marker is still a JPEG (ITU T.81 B.1.1.2)", () => {
    const padded = new Uint8Array([
      0xff, 0xd8, 0xff, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x03, 0x01, 0xff, 0xd9,
    ]);
    expect(sniffImage(padded)).toEqual({ type: "image/jpeg", width: 3, height: 2 });
  });

  it("a JPEG whose SOF says height 0 is refused", () => {
    const zero = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x00, 0x00, 0x03, 0x01, 0xff, 0xd9,
    ]);
    expect(sniffImage(zero)).toBeNull();
  });
});

// ---- AVIF fixtures: hand-built ISOBMFF boxes -------------------------------
const cc = (s) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];
const box = (type, ...parts) => {
  const body = parts.flat(Infinity);
  return [...u32(8 + body.length), ...cc(type), ...body];
};
const fullbox = (type, ...parts) => box(type, [0, 0, 0, 0], ...parts);

const ispe = (w, h) => fullbox("ispe", u32(w), u32(h));
const irot = (angle) => box("irot", [angle & 3]);
const pitm = (id) => fullbox("pitm", u16(id));
const ipma = (entries) =>
  fullbox(
    "ipma",
    u32(entries.length),
    entries.map(([id, props]) => [u16(id), props.length, props.map((p) => p & 0x7f)]),
  );
const avifFile = ({ primary = 1, props = [], assoc = [], brand = "avif" } = {}) =>
  Uint8Array.from([
    ...box("ftyp", cc(brand), u32(0), cc("mif1")),
    ...fullbox("meta", pitm(primary), box("iprp", box("ipco", ...props), ipma(assoc))),
  ]);

describe("imageDimensions: AVIF (ISOBMFF ispe)", () => {
  it("reads the primary item's ispe", () => {
    const avif = avifFile({
      primary: 1,
      props: [ispe(300, 200)],
      assoc: [[1, [1]]],
    });
    expect(imageDimensions(avif)).toEqual({ width: 300, height: 200 });
  });

  it("picks the PRIMARY ispe, not the alpha item's (first-ispe is wrong)", () => {
    const avif = avifFile({
      primary: 2,
      props: [ispe(100, 50), ispe(640, 480)], // alpha first, primary second
      assoc: [
        [1, [1]],
        [2, [2]],
      ],
    });
    expect(imageDimensions(avif)).toEqual({ width: 640, height: 480 });
  });

  it("a 90°/270° irot transposes the displayed box", () => {
    const avif = avifFile({
      primary: 1,
      props: [ispe(300, 200), irot(1)],
      assoc: [[1, [1, 2]]],
    });
    expect(imageDimensions(avif)).toEqual({ width: 200, height: 300 });
  });

  it("a 180° irot does not transpose", () => {
    const avif = avifFile({
      primary: 1,
      props: [ispe(300, 200), irot(2)],
      assoc: [[1, [1, 2]]],
    });
    expect(imageDimensions(avif)).toEqual({ width: 300, height: 200 });
  });

  it("refuses ISOBMFF that is not an AVIF brand", () => {
    const avif = avifFile({ primary: 1, props: [ispe(1, 1)], assoc: [[1, [1]]], brand: "isom" });
    expect(imageDimensions(avif)).toBeNull();
  });

  it("never throws on truncated boxes", () => {
    const whole = avifFile({ primary: 1, props: [ispe(300, 200)], assoc: [[1, [1]]] });
    for (let cut = 8; cut < whole.length; cut += 7) {
      expect(() => imageDimensions(whole.slice(0, cut))).not.toThrow();
    }
  });
});

describe("zipStore", () => {
  it("crc32 matches the reference vector", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes a STORE archive a standard reader can walk", () => {
    const entries = [
      { name: "posts/hello.md", data: "---\nslug: \"hello\"\n---\n\nWords.\n" },
      { name: "media.json", data: "[]" },
    ];
    const bytes = zipStore(entries, { now: new Date("2026-07-18T12:00:00Z") });
    const view = new DataView(bytes.buffer);

    // Local header magic up front, EOCD at the tail (no comment → fixed 22).
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const eocd = bytes.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(entries.length);

    // Walk the central directory: signatures, UTF-8 flag, STORE, real CRCs,
    // and local offsets that point at real local headers.
    let at = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    const seen = [];
    for (let i = 0; i < entries.length; i += 1) {
      expect(view.getUint32(at, true)).toBe(0x02014b50);
      expect(view.getUint16(at + 8, true) & 0x0800).toBe(0x0800);
      expect(view.getUint16(at + 10, true)).toBe(0); // STORE
      const crc = view.getUint32(at + 16, true);
      const size = view.getUint32(at + 24, true);
      const nameLen = view.getUint16(at + 28, true);
      const name = decoder.decode(bytes.slice(at + 46, at + 46 + nameLen));
      const local = view.getUint32(at + 42, true);
      expect(view.getUint32(local, true)).toBe(0x04034b50);
      const dataStart = local + 30 + nameLen;
      const data = bytes.slice(dataStart, dataStart + size);
      expect(crc32(data)).toBe(crc);
      seen.push({ name, text: decoder.decode(data) });
      at += 46 + nameLen;
    }
    expect(seen.map((e) => e.name)).toEqual(["posts/hello.md", "media.json"]);
    expect(seen[0].text).toContain("Words.");
  });

  it("refuses more entries than the format can index", () => {
    const many = Array.from({ length: 0x10000 }, (_, i) => ({ name: `${i}`, data: "" }));
    expect(() => zipStore(many)).toThrow(/too many/);
  });
});

describe("postFrontMatter", () => {
  it("emits YAML-safe scalars and skips empty fields", () => {
    const fm = postFrontMatter({
      id: "abc",
      slug: "hello",
      kind: "essay",
      status: "draft",
      title: 'He said: "no" — twice',
      dek: "",
      series: null,
      series_part: 2,
      tags: '["records","hi-fi"]',
      header_style: "standard",
      mood: "default",
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
    });
    expect(fm.startsWith("---\n")).toBe(true);
    expect(fm).toContain('title: "He said: \\"no\\" — twice"');
    expect(fm).toContain("series_part: 2");
    expect(fm).toContain('tags: ["records","hi-fi"]');
    expect(fm).not.toContain("dek:");
    expect(fm).not.toContain("series:");
    expect(fm.endsWith("---\n\n")).toBe(true);
  });
});

describe("sniffImage: AVIF is named from its brand, not its extension", () => {
  it("an ISOBMFF with the avif brand is image/avif with the primary ispe", () => {
    const avif = avifFile({ props: [ispe(300, 200)], assoc: [[1, [1]]] });
    expect(sniffImage(avif)).toEqual({ type: "image/avif", width: 300, height: 200 });
  });

  it("an ISOBMFF that is not an AVIF brand is null", () => {
    const notAvif = avifFile({ brand: "isom", props: [ispe(300, 200)], assoc: [[1, [1]]] });
    expect(sniffImage(notAvif)).toBeNull();
  });
});
