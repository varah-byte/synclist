import type { FastifyInstance } from "fastify";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";
import { isMember } from "./groups.js";
import { broadcast } from "./realtime.js";

interface OpIn {
  opId: string;
  deviceId: string;
  seq: number;
  hlc: { wall: number; counter: number };
  type: "add" | "set" | "delete";
  itemId: string;
  field?: string;
  value?: unknown;
}

function rowToOp(r: any) {
  return {
    opId: r.op_id,
    deviceId: r.device_id,
    seq: r.seq,
    hlc: { wall: Number(r.hlc_wall), counter: r.hlc_counter },
    type: r.type,
    itemId: r.item_id,
    ...(r.field != null ? { field: r.field } : {}),
    ...(r.value !== null && r.value !== undefined ? { value: r.value } : {}),
  };
}

function validOp(o: any): o is OpIn {
  return (
    o &&
    typeof o.opId === "string" &&
    typeof o.deviceId === "string" &&
    Number.isInteger(o.seq) && o.seq >= 1 &&
    o.hlc && Number.isFinite(o.hlc.wall) && Number.isInteger(o.hlc.counter) &&
    ["add", "set", "delete"].includes(o.type) &&
    typeof o.itemId === "string"
  );
}

export async function syncRoutes(app: FastifyInstance) {
  app.post("/groups/:id/sync", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { ops?: unknown[]; vv?: Record<string, number> };
    const ops = body.ops ?? [];
    const vv = body.vv ?? {};

    if (!(await isMember(id, req.user.userId))) {
      return reply.code(403).send({ error: "Not a member" });
    }
    if (!Array.isArray(ops) || !ops.every(validOp)) {
      return reply.code(400).send({ error: "Invalid ops" });
    }

    // 1. Insert new ops. Duplicates are skipped (S5).
    const inserted: OpIn[] = [];
    for (const o of ops as OpIn[]) {
      const res = await pool.query(
        `INSERT INTO ops_log
           (group_id, op_id, device_id, seq, hlc_wall, hlc_counter, type, item_id, field, value)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (group_id, op_id) DO NOTHING
         RETURNING log_id`,
        [
          id, o.opId, o.deviceId, o.seq, o.hlc.wall, o.hlc.counter,
          o.type, o.itemId, o.field ?? null,
          o.value === undefined ? null : JSON.stringify(o.value),
        ]
      );
      if (res.rowCount) inserted.push(o);
    }

    broadcast(id, inserted.map((o) => ({ ...o })));

    // 2. Return ops the client lacks
    const { rows } = await pool.query(
      `SELECT * FROM ops_log
       WHERE group_id = $1
         AND seq > COALESCE(($2::jsonb ->> device_id)::int, 0)
       ORDER BY log_id`,
      [id, JSON.stringify(vv)]
    );
    const last = await pool.query(
      "SELECT COALESCE(MAX(log_id), 0)::int AS m FROM ops_log WHERE group_id = $1",
      [id]
    );

    return { ops: rows.map(rowToOp), serverLogId: last.rows[0].m };
  });
}
