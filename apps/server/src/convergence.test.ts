import { describe, it, expect } from "vitest";
import WebSocket from "ws";

const BASE = process.env.BASE ?? "http://20.207.86.59";
const WSBASE = BASE.replace("http", "ws");

async function call(path: string, token: string | null, body?: unknown) {
  const r = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(path + " " + (data.error ?? r.status));
  return data;
}

describe("convergence time", () => {
  it("edit on A reaches B in under 5 seconds (30 samples)", async () => {
    const stamp = Date.now();
    const a = await call("/auth/signup", null, { email: `ca-${stamp}@t.com`, password: "secret123" });
    const b = await call("/auth/signup", null, { email: `cb-${stamp}@t.com`, password: "secret123" });
    const g = await call("/groups", a.token, { name: "conv" });
    await call("/groups/join", b.token, { joinCode: g.joinCode });

    // B listens over WebSocket
    const ws = new WebSocket(`${WSBASE}/groups/${g.id}/subscribe?token=${b.token}`);
    const arrivals = new Map<string, number>();
    ws.on("message", (m) => {
      const msg = JSON.parse(m.toString());
      if (msg.type === "ops") for (const o of msg.ops) arrivals.set(o.opId, performance.now());
    });
    await new Promise((res) => ws.on("open", res));
    await new Promise((r) => setTimeout(r, 500));

    const times: number[] = [];
    for (let i = 1; i <= 30; i++) {
      const op = {
        opId: `A-${i}`, deviceId: "A", seq: i,
        hlc: { wall: Date.now(), counter: 0 },
        type: "add", itemId: `item-${i}`, value: `v${i}`,
      };
      const t0 = performance.now();
      await call(`/groups/${g.id}/sync`, a.token, { ops: [op], vv: {} });
      const deadline = Date.now() + 5000;
      while (!arrivals.has(op.opId) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 5));
      expect(arrivals.has(op.opId)).toBe(true);
      times.push(arrivals.get(op.opId)! - t0);
    }
    ws.close();

    times.sort((x, y) => x - y);
    const p = (q: number) => times[Math.floor(q * (times.length - 1))].toFixed(0);
    console.log(`convergence ms: min=${times[0].toFixed(0)} median=${p(0.5)} p95=${p(0.95)} max=${times[times.length - 1].toFixed(0)}`);
    expect(times[times.length - 1]).toBeLessThan(5000);
  }, 60000);
});
