import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Op } from "./types";
import { applyOp, emptyState, visibleItems } from "./state";

const SEED_ITEMS = ["s1", "s2", "s3"];

// Shared starting items, all from device "S"
const seedOps: Op[] = SEED_ITEMS.map((id, i) => ({
  opId: `S-${i + 1}`,
  deviceId: "S",
  seq: i + 1,
  hlc: { wall: i + 1, counter: 0 },
  type: "add",
  itemId: id,
  value: `seed-${id}`,
}));

const actionArb = fc.record({
  kind: fc.constantFrom("add", "set", "delete"),
  item: fc.constantFrom(...SEED_ITEMS),
  field: fc.constantFrom("name", "quantity"),
  value: fc.string({ maxLength: 5 }),
  inc: fc.integer({ min: 1, max: 5 }),
});

// One device's ops: seq 1..n, HLC strictly increasing
const deviceOpsArb = (dev: string) =>
  fc.array(actionArb, { maxLength: 6 }).map((actions) => {
    let wall = 100;
    return actions.map((a, i): Op => {
      wall += a.inc;
      const seq = i + 1;
      const base = { opId: `${dev}-${seq}`, deviceId: dev, seq, hlc: { wall, counter: 0 } };
      if (a.kind === "add")
        return { ...base, type: "add", itemId: `${dev}-item-${seq}`, value: a.value };
      if (a.kind === "set")
        return { ...base, type: "set", itemId: a.item, field: a.field, value: a.value };
      return { ...base, type: "delete", itemId: a.item };
    });
  });

const allOpsArb = fc
  .tuple(deviceOpsArb("A"), deviceOpsArb("B"), deviceOpsArb("C"))
  .map(([a, b, c]) => [...seedOps, ...a, ...b, ...c]);

// Seeded shuffle, so failures can be replayed
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const apply = (ops: Op[]) => ops.reduce(applyOp, emptyState());

describe("convergence (property-based)", () => {
  it("any delivery order gives the same final state", () => {
    fc.assert(
      fc.property(allOpsArb, fc.nat(), fc.nat(), (ops, s1, s2) => {
        const r1 = apply(shuffle(ops, s1));
        const r2 = apply(shuffle(ops, s2));
        expect(visibleItems(r1)).toEqual(visibleItems(r2));
        expect(r1.vv).toEqual(r2.vv);
        expect(r1.pending).toHaveLength(0); // nothing stuck
      })
    );
  });

  it("duplicate deliveries change nothing", () => {
    fc.assert(
      fc.property(allOpsArb, fc.nat(), fc.nat(), (ops, s1, s2) => {
        const once = apply(shuffle(ops, s1));
        const twice = apply(shuffle([...ops, ...ops], s2));
        expect(visibleItems(twice)).toEqual(visibleItems(once));
        expect(twice.vv).toEqual(once.vv);
      })
    );
  });

  it("two replicas merging halves in opposite order converge", () => {
    fc.assert(
      fc.property(allOpsArb, fc.nat(), (ops, seed) => {
        const mixed = shuffle(ops, seed);
        const mid = Math.floor(mixed.length / 2);
        const h1 = mixed.slice(0, mid);
        const h2 = mixed.slice(mid);
        const r1 = apply([...h1, ...h2]);
        const r2 = apply([...h2, ...h1]);
        expect(visibleItems(r1)).toEqual(visibleItems(r2));
        expect(r1.vv).toEqual(r2.vv);
      })
    );
  });
});