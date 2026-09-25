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

/** @param {number} ms */
function plusMs(ms) {
  return new Date(Date.now() + ms).toISOString();
}

// The ONE constant-time compare, for the credential hash AND the CSRF token
// (security floor, 2026-09-18 — until then the token was compared with
// `===`). `crypto.subtle.timingSafeEqual` is the Workers runtime's own
// (workerd-only: Node's SubtleCrypto has no such method, so the unit test
// installs one with the same contract). It THROWS on a length mismatch, so
// the length check first is load-bearing, not tidiness: a wrong-length token
// must be `false`, never a 500.
/** @param {string} a @param {string} b */
function constantTimeEqual(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  return crypto.subtle.timingSafeEqual(bufA, bufB);
}

/** @param {Request} request */
function clientBucket(request) {
  return request.headers.get("cf-connecting-ip") ?? "local";
}

/** @typedef {{ id_hash: string, csrf_token: string, created_at: string, expires_at: string, last_seen: string, ua: string }} SessionRow */
/** @typedef {{ locked: true, ok?: undefined } | { ok: false, locked?: undefined } | { ok: true, setCookie: string, locked?: undefined }} LoginResult */

/** @param {Env} env @param {Request} request */
export async function checkLockout(env, request) {
  const row = /** @type {{ locked_until: string | null } | null} */ (
    await env.DB.prepare(
      "SELECT locked_until FROM login_attempts WHERE bucket = ?",
    )
      .bind(clientBucket(request))
      .first()
  );
  return Boolean(row?.locked_until && row.locked_until > nowIso());
}

// One statement, so the increment is atomic (security floor, 2026-09-18).
// The previous shape was read-modify-write — SELECT the count, add one in
// JS, UPSERT it back — so a parallel burst of wrong credentials read the
// same count and wrote the same count + 1: twenty attempts could land as
// one, and the documented 5-per-10-minutes lockout never fired. Harmless
// against a 256-bit credential, but the guard was not sabotage-proof by the
// repo's own standard. SQLite's upsert sees the EXISTING row as
// `login_attempts.*`, so the window test, the increment and the lockout
// threshold are all expressed against the row the statement is updating:
//   in window  → count + 1, window kept
//   window old → 1, window restarts now
//   new count ≥ MAX_FAILURES → locked_until = now + LOCKOUT, else NULL.
// Proven on real SQLite (node:sqlite) in test/auth.test.js — its one-statement
// and twenty-interleaved-increments legs are the guard that bites (both fail
// under read-modify-write). The origin suite's 20-parallel burst exercises
// the lockout end-to-end on the plane's D1 but does NOT distinguish the two
// statement shapes there: local D1 serialised the burst enough for the racy
// code to reach the threshold too (sabotage 2026-09-18, three runs).
/** @param {Env} env @param {Request} request */
export async function recordFailure(env, request) {
  const now = nowIso();
  const windowFloor = new Date(Date.now() - WINDOW_MS).toISOString();
  await env.DB.prepare(
    `INSERT INTO login_attempts (bucket, count, window_start, locked_until)
     VALUES (?1, 1, ?2, NULL)
     ON CONFLICT (bucket) DO UPDATE SET
       count = CASE WHEN login_attempts.window_start > ?3
                    THEN login_attempts.count + 1 ELSE 1 END,
       window_start = CASE WHEN login_attempts.window_start > ?3
                           THEN login_attempts.window_start ELSE ?2 END,
       locked_until = CASE WHEN (CASE WHEN login_attempts.window_start > ?3
                                      THEN login_attempts.count + 1 ELSE 1 END) >= ?4
                           THEN ?5 ELSE NULL END`,
  )
    .bind(clientBucket(request), now, windowFloor, MAX_FAILURES, plusMs(LOCKOUT_MS))
    .run();
}

/** @param {Env} env @param {Request} request */
async function clearFailures(env, request) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE bucket = ?")
    .bind(clientBucket(request))
    .run();
}

// Returns a Set-Cookie value on success, null on failure. The submitted
// credential is hashed and compared constant-time against the secret hash —
// the credential itself exists nowhere on the server.
/** @param {Env} env @param {Request} request @param {string} credential @returns {Promise<LoginResult>} */
export async function login(env, request, credential) {
  if (await checkLockout(env, request)) return { locked: true };
  const submitted = await sha256Hex(credential ?? "");
  if (!constantTimeEqual(submitted, env.ADMIN_CREDENTIAL_HASH ?? "")) {
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

/** @param {Request} request @returns {string | null} */
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
/** @param {Env} env @param {Request} request @param {{ renew?: boolean }} [options] @returns {Promise<SessionRow | null>} */
export async function getSession(env, request, { renew = true } = {}) {
  const token = cookieToken(request);
  if (!token) return null;
  const idHash = await sha256Hex(token);
  const session = /** @type {SessionRow | null} */ (
    await env.DB.prepare(
      "SELECT * FROM sessions WHERE id_hash = ? AND expires_at > ?",
    )
      .bind(idHash, nowIso())
      .first()
  );
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

/** @param {Env} env @param {Request} request @returns {Promise<string>} the clearing Set-Cookie value */
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
/** @param {Env} env @returns {Promise<string>} the clearing Set-Cookie value */
export async function logoutAll(env) {
  await env.DB.prepare("DELETE FROM sessions").run();
  return `${COOKIE}=; Path=/blog; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Mutations require the per-session CSRF token in a custom header (setting
// it cross-origin forces a preflight that will fail), and any browser-sent
// Sec-Fetch-Site must be same-origin. Login/logout forms carry the token as
// a field instead — same bar, no JS required. The token is compared through
// the same constant-time helper the credential uses (security floor,
// 2026-09-18): one compare discipline for every secret the wall holds.
/** @param {Request} request @param {SessionRow} session @param {string | null} [formToken] */
export function csrfOk(request, session, formToken = null) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }
  const presented =
    request.headers.get("x-pm-blog-csrf") ?? formToken ?? "";
  return presented.length > 0 && constantTimeEqual(presented, session.csrf_token);
}
