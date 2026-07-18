// Id + token generation. Ids are time-sortable (ms timestamp base-32, fixed
// width, then randomness) so revisions and media order by primary key; tokens
// are 256-bit crypto-random base64url — session ids, preview links, CSRF.

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function newId() {
  let ms = Date.now();
  let time = "";
  for (let i = 0; i < 9; i += 1) {
    time = ALPHABET[ms % 32] + time;
    ms = Math.floor(ms / 32);
  }
  const rand = crypto.getRandomValues(new Uint8Array(10));
  let tail = "";
  for (const byte of rand) tail += ALPHABET[byte % 32];
  return time + tail;
}

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
