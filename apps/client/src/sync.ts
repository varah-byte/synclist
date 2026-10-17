import type { Op } from "@synclist/crdt";
import { db } from "./db";
import { getOutbox, clearOutbox, saveRemoteOps } from "./store";

export const API = "http://20.207.86.59";
const WS = "ws://20.207.86.59";
export const net = { offline: false };

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

async function localVv(groupId: string): Promise<Record<string, number>> {
  const all = await db.ops.where("groupId").equals(groupId).toArray();
  const vv: Record<string, number> = {};
  for (const o of all) vv[o.deviceId] = Math.max(vv[o.deviceId] ?? 0, o.seq);
  return vv;
}

let running = false;
export async function syncGroup(groupId: string, token: string) {
  if (running) return { sent: 0, received: 0 };
  if (net.offline) return { sent: 0, received: 0 };
  running = true;
  try {
    const outbox = await getOutbox(groupId);
    const ops: Op[] = outbox.map(({ groupId: _g, ...op }) => op);
    const vv = await localVv(groupId);
    const res = await api(`/groups/${groupId}/sync`, token, { ops, vv });
    await saveRemoteOps(groupId, res.ops as Op[]);
    await clearOutbox(groupId, outbox.map((o) => o.opId));
    return { sent: ops.length, received: (res.ops as Op[]).length };
  } finally {
    running = false;
  }
}

// Open the live connection. Returns a function that closes it.
export function connectLive(groupId: string, token: string, onChange: () => void) {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout>;

  const open = () => {
    ws = new WebSocket(`${WS}/groups/${groupId}/subscribe?token=${token}`);
    ws.onmessage = async (e) => {
      if (net.offline) return;
      const m = JSON.parse(e.data);
      if (m.type === "ops") {
        await saveRemoteOps(groupId, m.ops as Op[]);
        onChange();
      }
    };
    ws.onopen = () => { syncGroup(groupId, token).then(onChange).catch(() => {}); };
    ws.onclose = () => { if (!closed) retry = setTimeout(open, 2000); };
  };
  open();
  return () => { closed = true; clearTimeout(retry); ws?.close(); };
}
