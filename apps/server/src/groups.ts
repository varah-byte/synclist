import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";

export async function isMember(groupId: string, userId: string) {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function groupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/groups", async (req, reply) => {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return reply.code(400).send({ error: "Name required" });
    const joinCode = randomBytes(4).toString("hex").toUpperCase();
    const { rows } = await pool.query(
      "INSERT INTO groups (name, join_code, created_by) VALUES ($1, $2, $3) RETURNING id",
      [name.trim(), joinCode, req.user.userId]
    );
    await pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
      [rows[0].id, req.user.userId]
    );
    return { id: rows[0].id, joinCode };
  });

  app.post("/groups/join", async (req, reply) => {
    const { joinCode } = req.body as { joinCode?: string };
    if (!joinCode) return reply.code(400).send({ error: "joinCode required" });
    const { rows } = await pool.query(
      "SELECT id FROM groups WHERE join_code = $1",
      [joinCode.toUpperCase()]
    );
    if (!rows[0]) return reply.code(404).send({ error: "Invalid code" });
    await pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [rows[0].id, req.user.userId]
    );
    return { id: rows[0].id };
  });

  app.get("/groups", async (req) => {
    const { rows } = await pool.query(
      `SELECT g.id, g.name, g.join_code AS "joinCode",
              (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id) AS members
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1
       ORDER BY g.created_at`,
      [req.user.userId]
    );
    return rows;
  });
}
