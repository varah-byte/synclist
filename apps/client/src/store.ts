import { applyOp, emptyState, tickHlc, visibleItems, type Op, type State, type Hlc } from "@synclist/crdt";
import { db, type StoredOp } from "./db";

async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key);
  return (m?.value as T) ?? fallback;
}
const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });

export async function getDeviceId(): Promise<string> {
  let id = await getMeta<string | null>("deviceId", null);
  if (!id) {
    id = "dev-" + crypto.randomUUID().slice(0, 8);
    await setMeta("deviceId", id);
  }
  return id;
}

// Build state by replaying all stored ops for a group
export async function loadState(groupId: string): Promise<State> {
  const all = await db.ops.where("groupId").equals(groupId).toArray();
  return all.reduce<State>((s, o) => applyOp(s, o), emptyState());
}

export async function loadItems(groupId: string) {
  return visibleItems(await loadState(groupId));
}

// Create a local op: assign seq + HLC, save to ops and outbox
export async function createOp(
  groupId: string,
  partial: Pick<Op, "type" | "itemId" | "field" | "value">
): Promise<Op> {
  const deviceId = await getDeviceId();
  const seq = (await getMeta<number>("seq:" + deviceId, 0)) + 1;
  const lastHlc = await getMeta<Hlc>("hlc", { wall: 0, counter: 0 });
  const hlc = tickHlc(lastHlc);

  const op: Op = { opId: `${deviceId}-${seq}`, deviceId, seq, hlc, ...partial };
  const stored: StoredOp = { ...op, groupId };

  await db.transaction("rw", db.ops, db.outbox, db.meta, async () => {
    await db.ops.put(stored);
    await db.outbox.put(stored);
    await setMeta("seq:" + deviceId, seq);
    await setMeta("hlc", hlc);
  });
  return op;
}

// Save ops received from the server (no outbox)
export async function saveRemoteOps(groupId: string, ops: Op[]) {
  await db.ops.bulkPut(ops.map((o) => ({ ...o, groupId })));
}

export const getOutbox = (groupId: string) =>
  db.outbox.where("groupId").equals(groupId).toArray();

export const clearOutbox = (groupId: string, opIds: string[]) =>
  db.outbox.bulkDelete(opIds.map((id) => [groupId, id] as [string, string]));
