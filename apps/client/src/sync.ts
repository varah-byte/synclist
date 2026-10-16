import type { Op } from "@synclist/crdt";
import { db } from "./db";
import { getOutbox, clearOutbox, saveRemoteOps } from "./store";

export const API = "http://localhost:3000";

export async function api(path: string, token: string | null, body?: unknown) {
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

// version vector: deviceId -> highest seq stored locally
async function localVv(groupId: string): Promise<Record<string, number>> {
  const all = await db.ops.where("groupId").equals(groupId).toArray();
  const vv: Record<string, number> = {};
  for (const o of all) vv[o.deviceId] = Math.max(vv[o.deviceId] ?? 0, o.seq);
  return vv;
}

export async function syncGroup(groupId: string, token: string) {
  const outbox = await getOutbox(groupId);
  const ops: Op[] = outbox.map(({ groupId: _g, ...op }) => op);
  const vv = await localVv(groupId);

  const res = await api(`/groups/${groupId}/sync`, token, { ops, vv });

  await saveRemoteOps(groupId, res.ops as Op[]);
  await clearOutbox(groupId, outbox.map((o) => o.opId));
  return { sent: ops.length, received: (res.ops as Op[]).length };
}
