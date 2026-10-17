import { describe, it, expect } from "vitest";
import http from "node:http";
import { applyOp, emptyState, visibleItems, tickHlc, type Op, type State, type Hlc } from "@synclist/crdt";

const TARGET = "http://localhost:3000";
const PROXY_PORT = 3999;
const PROXY = `http://localhost:${PROXY_PORT}`;

// Fault-injecting proxy: random delay, random drops, and a switchable partition
const fault = { delayMs: 0, dropRate: 0, partition: false };
const proxy = http.createServer(async (req, res) => {
  if (fault.partition || Math.random() < fault.dropRate) { req.socket.destroy(); return; }
  await new Promise((r) => setTimeout(r, Math.random() * fault.delayMs));
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const r = await fetch(TARGET + req.url, {
    method: req.method,
    headers: { "content-type": "application/json", ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}) },
    body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
  });
  res.writeHead(r.status, { "content-type": "application/json" });
  res.end(await r.text());
});

async function call(base: string, path: string, token: string | null, body?: unknown) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(path + " " + (data.error ?? r.status));
  return data;
}

class Client {
  state: State = emptyState();
  outbox: Op[] = [];
  seq = 0;
  hlc: Hlc = { wall: 0, counter: 0 };
  constructor(public dev: string, public token: string, public gid: string) {}
  make(p: Pick<Op, "type" | "itemId" | "field" | "value">) {
    this.seq++;
    this.hlc = tickHlc(this.hlc);
    const op: Op = { opId: `${this.dev}-${this.seq}`, deviceId: this.dev, seq: this.seq, hlc: this.hlc, ...p };
    this.state = applyOp(this.state, op);
    this.outbox.push(op);
  }
  // Sync through the faulty proxy; failures are tolerated and retried later
  async trySync() {
    const sending = [...this.outbox];
    try {
      const res = await call(PROXY, `/groups/${this.gid}/sync`, this.token, { ops: sending, vv: { ...this.state.vv } });
      this.outbox = this.outbox.filter((o) => !sending.includes(o));
      for (const o of res.ops as Op[]) this.state = applyOp(this.state, o);
      return true;
    } catch { return false; }
  }
}

describe("convergence under network faults", () => {
  it("3 clients converge despite latency, drops and a partition", async () => {
    await new Promise<void>((r) => proxy.listen(PROXY_PORT, r));
    const stamp = Date.now();
    const tokens: string[] = [];
    for (let i = 1; i <= 3; i++) {
      tokens.push((await call(TARGET, "/auth/signup", null, { email: `f${i}-${stamp}@t.com`, password: "secret123" })).token);
    }
    const g = await call(TARGET, "/groups", tokens[0], { name: "faults" });
    await call(TARGET, "/groups/join", tokens[1], { joinCode: g.joinCode });
    await call(TARGET, "/groups/join", tokens[2], { joinCode: g.joinCode });
    const cs = tokens.map((t, i) => new Client(`f${i + 1}-${stamp}`, t, g.id));

    // Phase 1: partition. Everyone edits, nothing can sync.
    fault.partition = true;
    for (let r = 0; r < 5; r++) for (const c of cs) {
      c.make({ type: "add", itemId: `${c.dev}-item-${r}`, value: `v${r}` });
    }
    let okDuringPartition = 0;
    for (const c of cs) if (await c.trySync()) okDuringPartition++;
    expect(okDuringPartition).toBe(0);

    // Phase 2: partition heals but network is slow and lossy
    fault.partition = false; fault.delayMs = 200; fault.dropRate = 0.3;
    let attempts = 0, failures = 0;
    for (let round = 0; round < 40; round++) {
      for (const c of cs) { attempts++; if (!(await c.trySync())) failures++; }
    }

    // Phase 3: clean network, final sync rounds
    fault.delayMs = 0; fault.dropRate = 0;
    for (let round = 0; round < 3; round++) for (const c of cs) await c.trySync();

    console.log(`fault test: ${attempts} sync attempts under faults, ${failures} dropped`);
    const a = visibleItems(cs[0].state), b = visibleItems(cs[1].state), c3 = visibleItems(cs[2].state);
    expect(a).toHaveLength(15);
    expect(b).toEqual(a);
    expect(c3).toEqual(a);
    proxy.close();
  }, 120000);
});
