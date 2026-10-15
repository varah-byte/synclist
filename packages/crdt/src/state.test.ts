import { describe, it, expect } from "vitest";
import type { Op } from "./types";
import { applyOp, emptyState, visibleItems } from "./state";

const mk = (
  dev: string, seq: number, wall: number, type: Op["type"],
  itemId: string, field?: string, value?: unknown
): Op => ({
  opId: `${dev}-${seq}`, deviceId: dev, seq,
  hlc: { wall, counter: 0 }, type, itemId, field, value,
});

const run = (ops: Op[]) => visibleItems(ops.reduce(applyOp, emptyState()));

const addMilk = mk("S", 1, 1, "add", "m1", undefined, "Milk");

describe("scenarios", () => {
  it("S1 edit vs delete: delete wins in any order", () => {
    const rename = mk("A", 1, 105, "set", "m1", "name", "Oat Milk");
    const del = mk("B", 1, 107, "delete", "m1");
    expect(run([addMilk, rename, del])).toEqual([]);
    expect(run([addMilk, del, rename])).toEqual([]);
  });

  it("S2 same name, two items", () => {
    const a = mk("A", 1, 10, "add", "a1", undefined, "Eggs");
    const b = mk("B", 1, 11, "add", "b1", undefined, "Eggs");
    expect(run([a, b])).toHaveLength(2);
    expect(run([b, a])).toEqual(run([a, b]));
  });

  it("S3 concurrent renames: higher HLC wins", () => {
    const a = mk("A", 1, 105, "set", "m1", "name", "Oat Milk");
    const b = mk("B", 1, 107, "set", "m1", "name", "Soy Milk");
    expect(run([addMilk, a, b])[0].name).toBe("Soy Milk");
    expect(run([addMilk, b, a])[0].name).toBe("Soy Milk");
  });

  it("S4 different fields both survive", () => {
    const qty = mk("A", 1, 105, "set", "m1", "quantity", 2);
    const name = mk("B", 1, 107, "set", "m1", "name", "Oat Milk");
    const r = run([addMilk, qty, name]);
    expect(r[0]).toMatchObject({ name: "Oat Milk", quantity: 2 });
    expect(run([addMilk, name, qty])).toEqual(r);
  });

  it("S5 duplicate op ignored", () => {
    const a = mk("A", 1, 10, "add", "a1", undefined, "Eggs");
    expect(run([a, a, a])).toHaveLength(1);
  });

  it("S6 out of order: buffered then applied", () => {
    const op1 = mk("A", 1, 10, "add", "m1", undefined, "Milk");
    const op2 = mk("A", 2, 11, "set", "m1", "name", "Oat Milk");
    expect(run([op2, op1])).toEqual(run([op1, op2]));
    expect(run([op2, op1])[0].name).toBe("Oat Milk");
  });

  it("S7 delete + re-add: old stays deleted, new survives", () => {
    const addE1 = mk("S", 1, 1, "add", "e1", undefined, "Eggs");
    const del = mk("A", 1, 10, "delete", "e1");
    const addE2 = mk("B", 1, 11, "add", "e2", undefined, "Eggs");
    const r = run([addE1, del, addE2]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("e2");
    expect(run([addE2, del, addE1])).toEqual(r);
  });
});