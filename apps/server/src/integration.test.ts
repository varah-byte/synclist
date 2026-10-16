import { describe, it, expect } from "vitest";
import { applyOp, emptyState, visibleItems, tickHlc, type Op, type State, type Hlc } from "@synclist/crdt";

const API = "http://localhost:3000";

async function call(path: string, token: string | null, body?: unknown) {
  const r = await fetch(API + path, {
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
  async sync() {
    const vv = { ...this.state.vv };
    const res = await call(`/groups/${this.gid}/sync`, this.token, { ops: this.outbox, vv });
    this.outbox = [];
    for (const o of res.ops as Op[]) this.state = applyOp(this.state, o);
  }
}

describe("3 clients converge through the server", () => {
  it("conflicting offline edits end identical", async () => {
    const stamp = Date.now();
    const tokens: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const r = await call("/auth/signup", null, { email: `it${i}-${stamp}@t.com`, password: "secret123" });
      tokens.push(r.token);
    }
    const g = await call("/groups", tokens[0], { name: "IT" });
    await call("/groups/join", tokens[1], { joinCode: g.joinCode });
    await call("/groups/join", tokens[2], { joinCode: g.joinCode });

    const [c1, c2, c3] = tokens.map((t, i) => new Client(`c${i + 1}-${stamp}`, t, g.id));

    c1.make({ type: "add", itemId: "milk", value: "Milk" });
    await c1.sync(); await c2.sync(); await c3.sync();

    c1.make({ type: "set", itemId: "milk", field: "name", value: "Oat Milk" });
    c2.make({ type: "delete", itemId: "milk" });
    c3.make({ type: "add", itemId: "eggs", value: "Eggs" });
    c3.make({ type: "set", itemId: "eggs", field: "quantity", value: 12 });

    await c3.sync(); await c1.sync(); await c2.sync();
    await c1.sync(); await c3.sync(); await c2.sync();
    await c1.sync(); await c2.sync(); await c3.sync();

    const a = visibleItems(c1.state), b = visibleItems(c2.state), c = visibleItems(c3.state);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(a.map((i) => i.id)).toEqual(["eggs"]);
    expect(a[0]).toMatchObject({ name: "Eggs", quantity: 12 });
    expect(c1.state.pending).toHaveLength(0);
  });
});
