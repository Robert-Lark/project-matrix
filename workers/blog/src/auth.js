// The wall (ADR-0009 §5): one high-entropy credential verified against a
// SHA-256 hash held in a Worker secret, server-side revocable sessions in
// D1, custom-header CSRF, and a rate-limited login. Single author — there
// is no username dimension and nothing to enumerate.

import { newToken, sha256Hex } from "./ids.js";

const COOKIE = "pm_blog_s";
const SESSION_DAYS = 30;
const RENEW_BELOW_DAYS = 15;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 30 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function plusMs(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function timingSafeEqualHex(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  return crypto.subtle.timingSafeEqual(bufA, bufB);
}

function clientBucket(request) {
  return request.headers.get("cf-connecting-ip") ?? "local";
}

export async function checkLockout(env, request) {
  const row = await env.DB.prepare(
    "SELECT locked_until FROM login_attempts WHERE bucket = ?",
  )
    .bind(clientBucket(request))
    .first();
  return Boolean(row?.locked_until && row.locked_until > nowIso());
}

async function recordFailure(env, request) {
  const bucket = clientBucket(request);
  const windowFloor = new Date(Date.now() - WINDOW_MS).toISOString();
  const row = await env.DB.prepare(
    "SELECT count, window_start FROM login_attempts WHERE bucket = ?",
  )
    .bind(bucket)
    .first();
  const inWindow = row && row.window_start > windowFloor;
  const count = inWindow ? row.count + 1 : 1;
  const lockedUntil = count >= MAX_FAILURES ? plusMs(LOCKOUT_MS) : null;
  await env.DB.prepare(
    `INSERT INTO login_attempts (bucket, count, window_start, locked_until)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (bucket) DO UPDATE
       SET count = ?2, window_start = ?3, locked_until = ?4`,
  )
    .bind(bucket, count, inWindow ? row.window_start : nowIso(), lockedUntil)
    .run();
}

async function clearFailures(env, request) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE bucket = ?")
    .bind(clientBucket(request))
    .run();
}

// Returns a Set-Cookie value on success, null on failure. The submitted
// credential is hashed and compared constant-time against the secret hash —
// the credential itself exists nowhere on the server.
export async function login(env, request, credential) {
  if (await checkLockout(env, request)) return { locked: true };
  const submitted = await sha256Hex(credential ?? "");
  if (!timingSafeEqualHex(submitted, env.ADMIN_CREDENTIAL_HASH ?? "")) {
    await recordFailure(env, request);
    return { ok: false };
  }
  await clearFailures(env, request);
  const token = newToken();
  await env.DB.prepare(
    `INSERT INTO sessions (id_hash, csrf_token, created_at, expires_at, last_seen, ua)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      await sha256Hex(token),
      newToken(),
      nowIso(),
      plusMs(SESSION_DAYS * 86_400_000),
      nowIso(),
      request.headers.get("user-agent") ?? "",
    )
    .run();
  return {
    ok: true,
    setCookie: `${COOKIE}=${token}; Path=/blog; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}`,
  };
}

function cookieToken(request) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

// Valid session row or null; rolling renewal when under 15 days remain.
// renew:false is for high-fan-out sub-requests (editor chunk loads) that
// should not each fire a redundant renewal UPDATE.
export async function getSession(env, request, { renew = true } = {}) {
  const token = cookieToken(request);
  if (!token) return null;
  const idHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    "SELECT * FROM sessions WHERE id_hash = ? AND expires_at > ?",
  )
    .bind(idHash, nowIso())
    .first();
  if (!session) return null;
  if (renew && session.expires_at < plusMs(RENEW_BELOW_DAYS * 86_400_000)) {
    await env.DB.prepare(
      "UPDATE sessions SET expires_at = ?, last_seen = ? WHERE id_hash = ?",
    )
      .bind(plusMs(SESSION_DAYS * 86_400_000), nowIso(), idHash)
      .run();
  }
  return session;
}

export async function logout(env, request) {
  const token = cookieToken(request);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?")
      .bind(await sha256Hex(token))
      .run();
  }
  return `${COOKIE}=; Path=/blog; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// The stolen-cookie response (ADR-0009 §5 "revocable"): kill EVERY session,
// every device, including this one.
export async function logoutAll(env) {
  await env.DB.prepare("DELETE FROM sessions").run();
  return `${COOKIE}=; Path=/blog; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Mutations require the per-session CSRF token in a custom header (setting
// it cross-origin forces a preflight that will fail), and any browser-sent
// Sec-Fetch-Site must be same-origin. Login/logout forms carry the token as
// a field instead — same bar, no JS required.
export function csrfOk(request, session, formToken = null) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }
  const presented =
    request.headers.get("x-pm-blog-csrf") ?? formToken ?? "";
  return presented.length > 0 && presented === session.csrf_token;
}
