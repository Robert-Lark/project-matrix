/**
 * Per-visit CPU-ms accounting (ADR-0001 §7): the measured half of the cost
 * model. The receipt field must come from REAL accounting, never estimates,
 * and must name its source (issue #7) — so this module offers exactly two
 * honest shapes:
 *
 *  - {@link InspectorCpuSource} — LOCAL dev: a V8 CPU profile of every
 *    Worker on the canonical plane, captured over the workerd inspector
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
  beforeVisit(): Promise<void>;
  /** CPU-ms attributed to the visit since beforeVisit, or null. */
  afterVisit(): Promise<number | null>;
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
 * Profiles every listed Worker across each visit and sums the non-idle CPU:
 * a visit's canonical-plane cost is front + variant + edge together, which
 * is exactly what the cost model prices (ADR-0001 §7).
 */
export class InspectorCpuSource implements CpuSource {
  readonly sourceName: string;
  private readonly ports: ReadonlyArray<{ worker: string; port: number }>;
  private connections: CdpConnection[] | null = null;

  constructor(ports: ReadonlyArray<{ worker: string; port: number }>) {
    this.ports = ports;
    this.sourceName = `v8-inspector-profile over wrangler dev (workerd CDP Profiler → V8 SAMPLING profile, 100µs interval, (idle) excluded — measured, not a platform counter; sum of ${ports
      .map((p) => p.worker)
      .join("+")})`;
  }

  private async connect(): Promise<CdpConnection[]> {
    if (this.connections) return this.connections;
    this.connections = await Promise.all(
      this.ports.map(async ({ port }) => {
        const conn = await CdpConnection.open(port);
        await conn.send("Profiler.enable");
        await conn.send("Profiler.setSamplingInterval", { interval: 100 });
        return conn;
      }),
    );
    return this.connections;
  }

  async beforeVisit(): Promise<void> {
    const conns = await this.connect();
    await Promise.all(conns.map((c) => c.send("Profiler.start")));
  }

  async afterVisit(): Promise<number | null> {
    const conns = await this.connect();
    const profiles = await Promise.all(
      conns.map((c) => c.send("Profiler.stop") as Promise<{ profile: CdpProfile }>),
    );
    const micros = profiles.reduce((sum, p) => sum + nonIdleMicros(p.profile), 0);
    return micros / 1000;
  }

  async close(): Promise<void> {
    for (const conn of this.connections ?? []) conn.close();
    this.connections = null;
  }
}

/** The local composition's pinned inspector ports (tools/origin-suite). */
export const LOCAL_PLANE_INSPECTORS = [
  { worker: "pm-front", port: 9230 },
  { worker: "pm-placeholder-static", port: 9231 },
  { worker: "pm-placeholder-ssr", port: 9232 },
  { worker: "pm-edge", port: 9233 },
] as const;
