/**
 * Per-visit CPU-ms accounting (ADR-0001 §7): the measured half of the cost
 * model. The receipt field must come from REAL accounting, never estimates,
 * and must name its source (issue #7) — so this module offers exactly two
 * honest shapes:
 *
 *  - {@link InspectorCpuSource} — LOCAL dev: a V8 CPU profile of the
 *    serving-path Workers (front + the target's variant + edge) per visit,
 *    captured over the workerd inspector
 *    wrangler exposes (`--inspector-port`, CDP `Profiler` domain; endpoint
 *    discovered via the standard `/json` route). Verified empirically
 *    2026-07-09: profiling the edge Worker's cold PLP path attributes
 *    real time to `handlePlp`/`computeFacets`/R2 `get`. Sampling interval
 *    100µs; only `(idle)` samples are excluded — `(program)` is real
 *    isolate CPU and stays in. The wrangler proxy requires an `Origin`
 *    header on the websocket handshake (any value); Node's undici
 *    WebSocket passes it via its non-standard `headers` option.
 *
 *  - {@link UNAVAILABLE_CPU_SOURCE} — anywhere the plane's accounting isn't
 *    reachable (e.g. the deployed origin before/without an API token):
 *    `value: null` with the source naming what WOULD account it (Workers
 *    observability invocation logs / GraphQL analytics, which
 *    `observability.enabled` already turns on for every Worker here).
 *    A null beats a fabricated number — "never estimated" is the contract.
 */

export interface CpuSource {
  sourceName: string;
  /** Begin accounting for a visit to `targetPath` (bracket its serving path). */
  beforeVisit(targetPath: string): Promise<void>;
  /** CPU-ms attributed to the visit since beforeVisit, or null. */
  afterVisit(targetPath: string): Promise<number | null>;
  close(): Promise<void>;
}

export const UNAVAILABLE_CPU_SOURCE: CpuSource = {
  sourceName:
    "unavailable here — the deployed plane's accounting is Workers observability's per-invocation $workers.cpuTimeMs (harvestable via POST /accounts/{id}/workers/observability/telemetry/query with an API token; observability.enabled is already on for every plane Worker; verified against Cloudflare docs 2026-07-09), which arms with the deploy leg. Locally, use the inspector profiler against wrangler dev.",
  beforeVisit: async () => {},
  afterVisit: async () => null,
  close: async () => {},
};

interface CdpProfile {
  nodes: Array<{ id: number; callFrame: { functionName: string } }>;
  samples?: number[];
  timeDeltas?: number[];
}

class CdpConnection {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string }
  >();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as {
        id?: number;
        error?: { message: string };
        result?: unknown;
      };
      if (msg.id === undefined) return; // events — not subscribed
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
      else entry.resolve(msg.result);
    };
  }

  static async open(port: number): Promise<CdpConnection> {
    // Standard CDP discovery, then the advertised debugger endpoint.
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const [target] = (await res.json()) as Array<{ webSocketDebuggerUrl: string }>;
    if (!target?.webSocketDebuggerUrl) {
      throw new Error(`no inspector target advertised on port ${port}`);
    }
    // Non-standard undici option: wrangler's proxy rejects handshakes
    // without an Origin header (any value passes).
    const ws = new (WebSocket as unknown as new (
      url: string,
      opts: { headers: Record<string, string> },
    ) => WebSocket)(target.webSocketDebuggerUrl, {
      headers: { origin: "http://127.0.0.1" },
    });
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`inspector websocket refused on port ${port}`));
    });
    return new CdpConnection(ws);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void {
    this.ws.close();
  }
}

/** Non-(idle) sampled microseconds in a V8 CPU profile. */
function nonIdleMicros(profile: CdpProfile): number {
  const idleIds = new Set(
    profile.nodes
      .filter((n) => n.callFrame.functionName === "(idle)")
      .map((n) => n.id),
  );
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    if (!idleIds.has(samples[i]!)) total += deltas[i] ?? 0;
  }
  return total;
}

/**
 * Profiles the SERVING-PATH Workers for each visit and sums their non-idle CPU:
 * a visit's canonical-plane cost is front + the variant that served it + edge
 * together, which is exactly what the cost model prices (ADR-0001 §7). It does
 * NOT sum the whole plane — profiling non-serving isolates would let a sibling
 * suite's traffic on, say, pm-qwik contaminate a pm-vanilla visit's number, and
 * would force the full plane up to bench one variant (verify-slice, anti-rigging
 * lens). Connections open lazily per worker, so only the serving path need be up.
 */
export class InspectorCpuSource implements CpuSource {
  readonly sourceName: string;
  private readonly portByWorker: Map<string, number>;
  private readonly connections = new Map<string, CdpConnection>();

  constructor(ports: ReadonlyArray<{ worker: string; port: number }>) {
    this.portByWorker = new Map(ports.map((p) => [p.worker, p.port]));
    this.sourceName =
      "v8-inspector-profile over wrangler dev (workerd CDP Profiler → V8 SAMPLING profile, 100µs interval, (idle) excluded — measured, not a platform counter; per visit: front + the serving variant + edge)";
  }

  // Front dispatches every request and edge serves its data/asset subrequests,
  // so both are always in the serving path; the variant is the target's first
  // path segment. /api/* and /assets/* carry no variant (front + edge only).
  private servingWorkers(targetPath: string): string[] {
    const seg = targetPath.split("/")[1] ?? "";
    const serving = ["pm-front", "pm-edge"];
    if (seg && seg !== "api" && seg !== "assets") serving.push(`pm-${seg}`);
    return serving;
  }

  private async connectionFor(worker: string): Promise<CdpConnection> {
    const existing = this.connections.get(worker);
    if (existing) return existing;
    const port = this.portByWorker.get(worker);
    if (port === undefined) {
      throw new Error(
        `${worker} is on a measured serving path but has no registered inspector port (add it to LOCAL_PLANE_INSPECTORS).`,
      );
    }
    let conn: CdpConnection;
    try {
      conn = await CdpConnection.open(port);
    } catch (cause) {
      // Hard error, NAMED — never a silent skip. CPU is a SUM over the serving
      // path, so a missing serving-path inspector would silently under-attribute
      // (issue #16 defect 2, the failure this module exists to avoid). Only the
      // serving path must be up, so benching ONE variant needs just front + that
      // variant + edge — not the whole plane.
      throw new Error(
        `CPU inspector for ${worker} unreachable on port ${port} — bring up its serving path (front + ${worker} + edge) or drop --local-cpu; a missing serving-path inspector would under-attribute CPU.`,
        { cause },
      );
    }
    await conn.send("Profiler.enable");
    await conn.send("Profiler.setSamplingInterval", { interval: 100 });
    this.connections.set(worker, conn);
    return conn;
  }

  async beforeVisit(targetPath: string): Promise<void> {
    await Promise.all(
      this.servingWorkers(targetPath).map(async (w) =>
        (await this.connectionFor(w)).send("Profiler.start"),
      ),
    );
  }

  async afterVisit(targetPath: string): Promise<number | null> {
    const profiles = await Promise.all(
      this.servingWorkers(targetPath).map(
        async (w) =>
          (await this.connectionFor(w)).send("Profiler.stop") as Promise<{
            profile: CdpProfile;
          }>,
      ),
    );
    const micros = profiles.reduce((sum, p) => sum + nonIdleMicros(p.profile), 0);
    return micros / 1000;
  }

  async close(): Promise<void> {
    for (const conn of this.connections.values()) conn.close();
    this.connections.clear();
  }
}

/** The local composition's pinned inspector ports (tools/origin-suite) — the
 *  REGISTRY the serving-path attribution resolves against. A visit's CPU is
 *  front + the variant that served it + edge, so EVERY variant Worker must be
 *  registered here or its serving path can't be profiled — issue #16 defect 2:
 *  omitting the editorial variants attributed ZERO CPU to whichever one served
 *  the page while the placeholders it was compared against WERE sampled. Ports
 *  are the canonical plane's (tools/origin-suite/run-local.mjs). pm-blog (9234)
 *  stays OUT — ADR-0009 puts the blog outside every measurement fence. pm-remix3
 *  (9240) stays OUT for the same class of reason (editorial-build slice F): the
 *  fenced frontier exhibit is in no number, and upstream of this registry the
 *  runner REFUSES /remix3/* targets outright (assertBenchableTarget, batch.ts),
 *  so no measured serving path can ever include it — the absence here is
 *  belt-over-mechanism, not the fence itself. Only a visit's OWN serving-path
 *  inspector is required to be up (connectionFor opens lazily); a missing one
 *  on the path is a named hard error, never a silent under-attribution. */
export const LOCAL_PLANE_INSPECTORS = [
  { worker: "pm-front", port: 9230 },
  { worker: "pm-placeholder-static", port: 9231 },
  { worker: "pm-placeholder-ssr", port: 9232 },
  { worker: "pm-edge", port: 9233 },
  { worker: "pm-vanilla", port: 9235 },
  { worker: "pm-react-next", port: 9236 },
  { worker: "pm-astro", port: 9237 },
  { worker: "pm-qwik", port: 9238 },
  { worker: "pm-htmx", port: 9239 },
] as const;
