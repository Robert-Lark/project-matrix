/**
 * The wall's two 2026-09-18 hardenings (security floor; 2026-08-29 audit
 * priority 4, task 4), each held to an oracle independent of the code:
 *
 *  - The lockout increment runs against REAL SQLite (`node:sqlite`; D1 is
 *    SQLite and the DDL below is the committed migration's), so "one
 *    statement, no read-modify-write", the 5-failure threshold, the 30-minute
 *    lock and the 10-minute window reset are proven on the engine that
 *    executes them — not on a mock that agrees with the code by design. The
 *    origin suite's twenty-parallel burst (blog.test.ts) exercises the
 *    lockout end-to-end but does NOT distinguish this statement from
 *    read-modify-write on local D1 (sabotage 2026-09-18: the racy code
 *    passed it three times of three); the twenty-increment leg BELOW is the
 *    discriminating proof.
 *
 *  - The CSRF compare is proven to go THROUGH `crypto.subtle.timingSafeEqual`
 *    with the Workers runtime's contract (a TypeError on a length mismatch).
 *    Node's SubtleCrypto has no such method (checked: Node 24.13), so the leg
 *    installs one that RECORDS its calls — a test that only checked the
 *    boolean would pass against `===` too, which is exactly the defect.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkLockout, csrfOk, recordFailure } from "../src/auth.js";

const DDL = readFileSync(
  join(import.meta.dirname, "..", "migrations", "0001_init.sql"),
  "utf8",
).match(/CREATE TABLE login_attempts \([^;]*\);/)[0];

/** The slice of D1's statement API auth.js uses, over a real SQLite file. */
function d1(db, log) {
  return {
    prepare(sql) {
      log.push(sql);
      const statement = db.prepare(sql);
      return {
        bind(...params) {
          return {
            first: async () => statement.get(...params) ?? null,
            run: async () => {
              const result = statement.run(...params);
              return { meta: { changes: result.changes } };
            },
          };
        },
      };
    },
  };
}

const from = (ip) =>
  new Request("https://plane.test/blog/admin/login", {
    method: "POST",
    headers: { "cf-connecting-ip": ip },
  });

const row = (db, ip) => db.prepare("SELECT * FROM login_attempts WHERE bucket = ?").get(ip);

describe("the lockout increment, on real SQLite", () => {
  let db;
  let log;
  let env;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T10:00:00.000Z"));
    db = new DatabaseSync(":memory:");
    db.exec(DDL);
    log = [];
    env = { DB: d1(db, log) };
  });
  afterEach(() => {
    vi.useRealTimers();
    db.close();
  });

  it("is ONE statement — an INSERT … ON CONFLICT, never a SELECT first", async () => {
    await recordFailure(env, from("203.0.113.1"));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatch(/^\s*INSERT INTO login_attempts/);
    expect(log[0]).toContain("ON CONFLICT (bucket) DO UPDATE");
    expect(log[0]).not.toMatch(/select/i);
  });

  it("four failures do not lock; the fifth does, for thirty minutes", async () => {
    for (let i = 0; i < 4; i += 1) await recordFailure(env, from("203.0.113.1"));
    expect(await checkLockout(env, from("203.0.113.1"))).toBe(false);
    expect(row(db, "203.0.113.1").count).toBe(4);
    await recordFailure(env, from("203.0.113.1"));
    expect(await checkLockout(env, from("203.0.113.1"))).toBe(true);
    expect(row(db, "203.0.113.1")).toMatchObject({
      count: 5,
      window_start: "2026-09-18T10:00:00.000Z",
      locked_until: "2026-09-18T10:30:00.000Z",
    });
  });

  it("inside the ten-minute window the count climbs and the window start is kept", async () => {
    await recordFailure(env, from("203.0.113.1"));
    vi.setSystemTime(new Date("2026-09-18T10:05:00.000Z"));
    await recordFailure(env, from("203.0.113.1"));
    expect(row(db, "203.0.113.1")).toMatchObject({
      count: 2,
      window_start: "2026-09-18T10:00:00.000Z",
      locked_until: null,
    });
  });

  it("the lock expires at thirty minutes, and a failure past the window restarts the count at 1", async () => {
    for (let i = 0; i < 5; i += 1) await recordFailure(env, from("203.0.113.1"));
    vi.setSystemTime(new Date("2026-09-18T10:29:59.000Z"));
    expect(await checkLockout(env, from("203.0.113.1"))).toBe(true);
    vi.setSystemTime(new Date("2026-09-18T10:31:00.000Z"));
    expect(await checkLockout(env, from("203.0.113.1"))).toBe(false);
    await recordFailure(env, from("203.0.113.1"));
    expect(row(db, "203.0.113.1")).toMatchObject({
      count: 1,
      window_start: "2026-09-18T10:31:00.000Z",
      locked_until: null,
    });
  });

  it("twenty increments in one bucket count twenty — the statement carries the arithmetic, not the caller", async () => {
    await Promise.all(Array.from({ length: 20 }, () => recordFailure(env, from("203.0.113.1"))));
    expect(row(db, "203.0.113.1").count).toBe(20);
    expect(log.filter((sql) => /select/i.test(sql))).toHaveLength(0);
  });

  it("buckets are per client IP", async () => {
    for (let i = 0; i < 5; i += 1) await recordFailure(env, from("203.0.113.1"));
    expect(await checkLockout(env, from("203.0.113.1"))).toBe(true);
    expect(await checkLockout(env, from("203.0.113.2"))).toBe(false);
  });
});

describe("the CSRF compare goes through the constant-time helper", () => {
  const TOKEN = "a".repeat(43); // newToken(): 32 random bytes → 43 base64url chars
  const session = { csrf_token: TOKEN };
  const calls = [];
  const hadOriginal = Object.hasOwn(crypto.subtle, "timingSafeEqual");
  const original = crypto.subtle.timingSafeEqual;

  beforeEach(() => {
    calls.length = 0;
    // workerd's contract: TypeError on a length mismatch, else byte equality.
    crypto.subtle.timingSafeEqual = (a, b) => {
      calls.push([a.byteLength, b.byteLength]);
      if (a.byteLength !== b.byteLength) {
        throw new TypeError("Input buffers must have the same byte length");
      }
      const x = new Uint8Array(a);
      const y = new Uint8Array(b);
      let diff = 0;
      for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
      return diff === 0;
    };
  });
  afterEach(() => {
    if (hadOriginal) crypto.subtle.timingSafeEqual = original;
    else delete crypto.subtle.timingSafeEqual;
  });

  const request = (headers = {}) =>
    new Request("https://plane.test/blog/admin/api/posts/x", { method: "PUT", headers });

  it("a matching header token is accepted — and the compare was the constant-time one", () => {
    expect(csrfOk(request({ "x-pm-blog-csrf": TOKEN }), session)).toBe(true);
    expect(calls).toEqual([[43, 43]]);
  });

  it("a matching form-field token (the login/logout forms) takes the same path", () => {
    expect(csrfOk(request(), session, TOKEN)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("a same-length wrong token is refused through the same compare", () => {
    expect(csrfOk(request({ "x-pm-blog-csrf": "b".repeat(43) }), session)).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("a wrong-LENGTH token is false, not a TypeError — the length guard precedes the runtime call", () => {
    expect(csrfOk(request({ "x-pm-blog-csrf": "short" }), session)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("no token presented is false without touching the compare", () => {
    expect(csrfOk(request(), session)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("a cross-site Sec-Fetch-Site is refused before any token is read", () => {
    expect(
      csrfOk(request({ "sec-fetch-site": "cross-site", "x-pm-blog-csrf": TOKEN }), session),
    ).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
