// Minimal image dimension sniffing at upload time (PNG/JPEG/GIF/WebP) so
// every <img> the editor inserts carries width/height — zero CLS by
// construction, the same discipline the store holds itself to.

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
  return null;
}
