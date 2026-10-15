import type { Op } from "./types";
import { compareHlc, type Hlc } from "./hlc";

export interface FieldReg { value: unknown; hlc: Hlc; deviceId: string }
export interface Item { id: string; fields: Record<string, FieldReg>; deleted: boolean }
export interface State {
  items: Record<string, Item>;
  vv: Record<string, number>; // version vector: deviceId -> max seq applied
  pending: Op[];              // ops waiting for their dependencies
}

export const emptyState = (): State => ({ items: {}, vv: {}, pending: [] });

// Winner rule: higher HLC, then higher deviceId (S3)
function newer(aHlc: Hlc, aDev: string, b: FieldReg): boolean {
  const c = compareHlc(aHlc, b.hlc);
  return c !== 0 ? c > 0 : aDev > b.deviceId;
}

function isReady(s: State, op: Op): boolean {
  if (op.seq !== (s.vv[op.deviceId] ?? 0) + 1) return false; // gap (S6)
  if (op.type !== "add" && !s.items[op.itemId]) return false; // item unknown yet (S6)
  return true;
}

function applyReady(s: State, op: Op): State {
  const vv = { ...s.vv, [op.deviceId]: op.seq };
  const items = { ...s.items };
  const item = items[op.itemId];

  if (op.type === "add") {
    if (!item) {
      items[op.itemId] = {
        id: op.itemId,
        deleted: false,
        fields: { name: { value: op.value, hlc: op.hlc, deviceId: op.deviceId } },
      };
    }
  } else if (op.type === "delete") {
    items[op.itemId] = { ...item, deleted: true }; // tombstone (S1, S7)
  } else if (op.type === "set" && op.field && !item.deleted) {
    const cur = item.fields[op.field];
    if (!cur || newer(op.hlc, op.deviceId, cur)) {
      items[op.itemId] = {
        ...item,
        fields: {
          ...item.fields,
          [op.field]: { value: op.value, hlc: op.hlc, deviceId: op.deviceId },
        },
      };
    }
  }
  return { ...s, items, vv };
}

export function applyOp(state: State, op: Op): State {
  if (op.seq <= (state.vv[op.deviceId] ?? 0)) return state;       // duplicate (S5)
  if (state.pending.some((p) => p.opId === op.opId)) return state; // duplicate in buffer

  let s: State = { ...state, pending: [...state.pending, op] };
  let progress = true;
  while (progress) {
    progress = false;
    // drop buffered ops that are already applied
    s = { ...s, pending: s.pending.filter((p) => p.seq > (s.vv[p.deviceId] ?? 0)) };
    for (const p of s.pending) {
      if (isReady(s, p)) {
        s = applyReady(s, p);
        s = { ...s, pending: s.pending.filter((x) => x !== p) };
        progress = true;
        break;
      }
    }
  }
  return s;
}

// What the UI shows: tombstoned items are hidden
export type VisibleItem = { id: string } & Record<string, unknown>;

export function visibleItems(s: State): VisibleItem[] {
  return Object.values(s.items)
    .filter((i) => !i.deleted)
    .map((i) => ({
      id: i.id,
      ...Object.fromEntries(Object.entries(i.fields).map(([k, r]) => [k, r.value])),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
