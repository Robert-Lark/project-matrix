// STORE-only ZIP writer (ADR-0009 §2 follow-up: the zip-of-markdown export).
// ~90 lines against APPNOTE.TXT instead of a dependency: entries are stored
// uncompressed (markdown and JSON this size gain nothing from DEFLATE and
// the reader-side is "unzip anywhere"), names are flagged UTF-8, and there
// is no zip64 — a personal blog's words fit in 4 GB with room for a life's
// work; the guard below makes an overflow loud, not corrupt.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  // DOS timestamps have no zone; encode UTC so the export is deterministic.
  const time =
    (date.getUTCHours() << 11) |
    (date.getUTCMinutes() << 5) |
    (date.getUTCSeconds() >> 1);
  const day =
    ((Math.max(0, date.getUTCFullYear() - 1980)) << 9) |
    ((date.getUTCMonth() + 1) << 5) |
    date.getUTCDate();
  return { time, day };
}

// entries: [{ name: string, data: string | Uint8Array, mtime?: Date }]
// Returns the complete archive as one Uint8Array.
export function zipStore(entries, { now = new Date() } = {}) {
  if (entries.length > 0xffff) throw new Error("zip: too many entries");
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data =
      typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    if (data.length > 0xffffffff) throw new Error("zip: entry over 4 GB");
    const crc = crc32(data);
    const { time, day } = dosDateTime(entry.mtime ?? now);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true); // version needed: 2.0
    local.setUint16(6, 0x0800, true); // general purpose: UTF-8 names
    local.setUint16(8, 0, true); // method: STORE
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); // compressed = uncompressed
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true); // extra length
    locals.push(new Uint8Array(local.buffer), name, data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // central directory header
    central.setUint16(4, 20, true); // made by
    central.setUint16(6, 20, true); // needed
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, time, true);
    central.setUint16(14, day, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, name.length, true);
    // extra/comment/disk/attrs all zero.
    central.setUint32(42, offset, true); // local header offset
    centrals.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + data.length;
    if (offset > 0xffffffff) throw new Error("zip: archive over 4 GB");
  }

  const centralSize = centrals.reduce((n, part) => n + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
