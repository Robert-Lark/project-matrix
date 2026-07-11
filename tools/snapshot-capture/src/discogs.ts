/**
 * The paced Discogs client. Facts it encodes (verified against
 * https://www.discogs.com/developers, research pass 2026-07-10 — auth/rate
 * area adversarially confirmed 19/19):
 *
 * - Auth: `Authorization: Discogs token=<token>` header. The token is sent
 *   ONLY to the API host — image URLs are signed CDN URLs that need no auth
 *   (per Discogs staff), and shipping the credential to other hosts would
 *   widen its exposure for nothing. The query-param token alternative is
 *   never used (tokens must not appear in URLs, logs, or checkpoints).
 * - Rate limit: 60/min authenticated, a MOVING average over a 60s window,
 *   reported via X-Discogs-Ratelimit[-Used/-Remaining]. "Your application
 *   should take our global limit into account and throttle its requests
 *   locally" — so the client self-paces below the limit and additionally
 *   parks for a full window when Remaining runs low.
 * - 429 semantics are undocumented (no Retry-After promised): honor
 *   Retry-After when present, otherwise park for a full window.
 * - User-Agent is mandatory and must be unique to the app; image fetches
 *   without one are known to 403.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { sleep } from "./util";

const USER_AGENT =
  "project-matrix-snapshot-capture/0.1 +https://github.com/Robert-Lark/project-matrix";
const WINDOW_MS = 61_000; // one full rate window, plus a second of slack
const MAX_RATE_RETRIES = 10;
const MAX_TRANSIENT_RETRIES = 6;

export const TOKEN_FILE = join(homedir(), ".config", "project-matrix", "discogs-token");

/**
 * Capture-time-only credential (ADR-0002 §1). Read from the environment or
 * the untracked token file; never logged, never echoed, never sent anywhere
 * but the API host.
 */
export function loadToken(): string {
  const env = process.env["DISCOGS_TOKEN"]?.trim();
  if (env) return env;
  try {
    const file = readFileSync(TOKEN_FILE, "utf8").trim();
    if (file) return file;
  } catch {
    // fall through to the error below
  }
  throw new Error(
    `no Discogs token: set DISCOGS_TOKEN or write the token to ${TOKEN_FILE} (chmod 600)`,
  );
}

/** A non-retryable upstream status (4xx) — callers decide tombstone vs fatal. */
export class HttpStatusError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    // Log-safe by construction: origin + path only. Auth rides in a header
    // (never the URL) and signed image query strings stay out of messages.
    super(`HTTP ${status}: ${new URL(url).origin}${new URL(url).pathname}`);
  }
}

export interface ClientOptions {
  apiBase?: string;
  /** Lazy so that a fully-checkpointed re-run needs no token at all. */
  token?: () => string;
  minIntervalMs?: number;
  log?: (line: string) => void;
}

export class DiscogsClient {
  readonly apiBase: string;
  #tokenProvider: () => string;
  #token: string | null = null;
  #minIntervalMs: number;
  #nextAt = 0;
  #log: (line: string) => void;
  requestCount = 0;

  constructor(opts: ClientOptions = {}) {
    this.apiBase = opts.apiBase ?? "https://api.discogs.com";
    this.#tokenProvider = opts.token ?? loadToken;
    // 1100ms between request starts ≈ 54/min — self-throttled under the 60/min
    // moving window, per the docs' own instruction.
    this.#minIntervalMs = opts.minIntervalMs ?? 1100;
    this.#log = opts.log ?? (() => {});
  }

  async #pace(): Promise<void> {
    const now = Date.now();
    const at = Math.max(this.#nextAt, now);
    this.#nextAt = at + this.#minIntervalMs;
    if (at > now) await sleep(at - now);
  }

  /** Push the next request start at least `ms` into the future. */
  #park(ms: number): void {
    this.#nextAt = Math.max(this.#nextAt, Date.now() + ms);
  }

  async #request(url: string, withAuth: boolean): Promise<Response> {
    const headers: Record<string, string> = { "user-agent": USER_AGENT };
    if (withAuth) {
      this.#token ??= this.#tokenProvider();
      headers["authorization"] = `Discogs token=${this.#token}`;
    }
    const logUrl = `${new URL(url).origin}${new URL(url).pathname}`;

    let rateRetries = 0;
    let transientRetries = 0;
    for (;;) {
      await this.#pace();
      let res: Response;
      try {
        res = await fetch(url, { headers });
      } catch (err) {
        if (++transientRetries > MAX_TRANSIENT_RETRIES) throw err;
        const backoff = Math.min(2 ** transientRetries * 1000, 30_000);
        this.#log(`network error on ${logUrl} — retry ${transientRetries} in ${backoff}ms`);
        this.#park(backoff);
        continue;
      }
      this.requestCount += 1;

      // Park ONLY when the header is actually present: image-CDN responses
      // don't carry the ratelimit headers, and Number(null) === 0 would read
      // as "window spent" and park a full minute after EVERY image (probed —
      // it turns a ~25-minute image sweep into ~25 hours).
      const remainingHeader = res.headers.get("x-discogs-ratelimit-remaining");
      const remaining = remainingHeader === null ? NaN : Number(remainingHeader);
      if (Number.isFinite(remaining) && remaining <= 1) {
        this.#log(`rate window nearly spent (remaining=${remaining}) — parking ${WINDOW_MS}ms`);
        this.#park(WINDOW_MS);
      }

      if (res.status === 429) {
        await res.body?.cancel();
        if (++rateRetries > MAX_RATE_RETRIES) throw new HttpStatusError(429, url);
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 + 1000 : WINDOW_MS;
        this.#log(`429 on ${logUrl} — waiting ${wait}ms (retry ${rateRetries})`);
        this.#park(wait);
        continue;
      }

      if (res.status >= 500) {
        await res.body?.cancel();
        if (++transientRetries > MAX_TRANSIENT_RETRIES) throw new HttpStatusError(res.status, url);
        const backoff = Math.min(2 ** transientRetries * 1000, 30_000);
        this.#log(`${res.status} on ${logUrl} — retry ${transientRetries} in ${backoff}ms`);
        this.#park(backoff);
        continue;
      }

      if (!res.ok) {
        await res.body?.cancel();
        throw new HttpStatusError(res.status, url);
      }
      return res;
    }
  }

  /** GET an API path (leading slash, query included) — authenticated, paced. */
  async getJson(pathAndQuery: string): Promise<unknown> {
    const res = await this.#request(new URL(pathAndQuery, this.apiBase).toString(), true);
    return res.json();
  }

  /**
   * GET a binary asset by full URL (signed image CDN URL, fetched verbatim —
   * "changing any aspect of the URL will result in a bad request"). No token:
   * the credential never leaves the API host.
   */
  async getBinary(url: string): Promise<{ bytes: Buffer; contentType: string | null }> {
    const res = await this.#request(url, false);
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type"),
    };
  }
}
