// Minimal image dimension sniffing at upload time (PNG/JPEG/GIF/WebP/AVIF)
// so every <img> the editor inserts carries width/height — zero CLS by
// construction, the same discipline the store holds itself to.

// --- AVIF (ISOBMFF) ---------------------------------------------------------
// The displayed size lives in the PRIMARY item's `ispe` property — an AVIF
// with an alpha channel carries a second ispe for the auxiliary alpha item,
// so "first ispe wins" is wrong on exactly the files that have one. Walk
// meta → pitm (primary item id) → iprp/ipma (item→property associations)
// → iprp/ipco (the property list), pick the primary's ispe, and apply its
// irot: a 90°/270° rotation transposes the displayed box.

function findBox(view, start, end, type) {
  let at = start;
  while (at + 8 <= end) {
    let size = view.getUint32(at);
    const name = String.fromCharCode(
      view.getUint8(at + 4), view.getUint8(at + 5),
      view.getUint8(at + 6), view.getUint8(at + 7),
    );
    let header = 8;
    if (size === 1) {
      // 64-bit largesize: no image this could apply to is sniffable anyway.
      if (at + 16 > end) return null;
      const hi = view.getUint32(at + 8);
      if (hi !== 0) return null;
      size = view.getUint32(at + 12);
      header = 16;
    } else if (size === 0) {
      size = end - at; // box runs to the end of the enclosing space
    }
    if (size < header || at + size > end) return null;
    if (name === type) return { start: at + header, end: at + size };
    at += size;
  }
  return null;
}

function avifDimensions(bytes, view) {
  const ftyp = findBox(view, 0, bytes.length, "ftyp");
  if (!ftyp) return null;
  let brands = "";
  for (let at = ftyp.start; at < ftyp.end; at += 4) {
    if (at !== ftyp.start + 4) {
      brands += String.fromCharCode(
        view.getUint8(at), view.getUint8(at + 1),
        view.getUint8(at + 2), view.getUint8(at + 3),
      );
    }
  }
  if (!brands.includes("avif") && !brands.includes("avis")) return null;

  const meta = findBox(view, 0, bytes.length, "meta");
  if (!meta) return null;
  const metaBody = { start: meta.start + 4, end: meta.end }; // FullBox: skip version/flags

  // Primary item id (pitm is a FullBox; id is 16-bit in v0, 32-bit after).
  let primary = null;
  const pitm = findBox(view, metaBody.start, metaBody.end, "pitm");
  if (pitm) {
    const version = view.getUint8(pitm.start);
    primary = version === 0 ? view.getUint16(pitm.start + 4) : view.getUint32(pitm.start + 4);
  }

  const iprp = findBox(view, metaBody.start, metaBody.end, "iprp");
  if (!iprp) return null;
  const ipco = findBox(view, iprp.start, iprp.end, "ipco");
  if (!ipco) return null;

  // Collect the 1-indexed property list.
  const properties = [];
  let at = ipco.start;
  while (at + 8 <= ipco.end) {
    const size = view.getUint32(at);
    if (size < 8 || at + size > ipco.end) break;
    const name = String.fromCharCode(
      view.getUint8(at + 4), view.getUint8(at + 5),
      view.getUint8(at + 6), view.getUint8(at + 7),
    );
    properties.push({ name, start: at + 8, end: at + size });
    at += size;
  }

  // The primary item's property indices, from ipma.
  let indices = null;
  const ipma = findBox(view, iprp.start, iprp.end, "ipma");
  if (ipma && primary !== null) {
    const version = view.getUint8(ipma.start);
    const flags = view.getUint32(ipma.start) & 0xffffff;
    const count = view.getUint32(ipma.start + 4);
    let cursor = ipma.start + 8;
    for (let i = 0; i < count && cursor < ipma.end; i += 1) {
      const itemId = version < 1 ? view.getUint16(cursor) : view.getUint32(cursor);
      cursor += version < 1 ? 2 : 4;
      const associations = view.getUint8(cursor);
      cursor += 1;
      const wide = (flags & 1) === 1;
      const list = [];
      for (let j = 0; j < associations; j += 1) {
        if (wide) {
          list.push(view.getUint16(cursor) & 0x7fff);
          cursor += 2;
        } else {
          list.push(view.getUint8(cursor) & 0x7f);
          cursor += 1;
        }
      }
      if (itemId === primary) indices = list;
    }
  }

  // Fall back to "every property" only when there is no association map to
  // consult — then the first ispe is the best available answer.
  const mine = indices
    ? indices.map((i) => properties[i - 1]).filter(Boolean)
    : properties;
  const ispe = mine.find((p) => p.name === "ispe");
  if (!ispe || ispe.end - ispe.start < 12) return null;
  const width = view.getUint32(ispe.start + 4); // after FullBox version/flags
  const height = view.getUint32(ispe.start + 8);
  const irot = mine.find((p) => p.name === "irot");
  const rotated = irot && (view.getUint8(irot.start) & 3) % 2 === 1;
  if (width === 0 || height === 0) return null;
  return rotated ? { width: height, height: width } : { width, height };
}

export function imageDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47) {
    // PNG: IHDR is always the first chunk.
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    // GIF: logical screen descriptor, little-endian.
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
    // JPEG: walk markers to the first SOF.
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      const size = view.getUint16(at + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
      }
      at += 2 + size;
    }
    return null;
  }
  if (
    bytes.length >= 30 &&
    view.getUint32(0) === 0x52494646 && // RIFF
    view.getUint32(8) === 0x57454250 // WEBP
  ) {
    const format = view.getUint32(12); // fourcc
    if (format === 0x56503820) {
      // "VP8 " lossy: dimensions after the 3-byte frame tag + sync code.
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (format === 0x5650384c) {
      // "VP8L" lossless: 14-bit packed, minus-one coded.
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (format === 0x56503858) {
      // "VP8X" extended: 24-bit little-endian, minus-one coded.
      const w = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16);
      const h = bytes[27] | (bytes[28] << 8) | (bytes[29] << 16);
      return { width: w + 1, height: h + 1 };
    }
  }
  if (bytes.length >= 16 && view.getUint32(4) === 0x66747970) {
    // "ftyp" at offset 4 — an ISOBMFF container; AVIF if the brands say so.
    try {
      return avifDimensions(bytes, view);
    } catch {
      return null; // truncated/malformed boxes must refuse, never throw
    }
  }
  return null;
}
