import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (req, reply) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password || password.length < 6) {
      return reply.code(400).send({ error: "Email and password (min 6 chars) required" });
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [email.toLowerCase(), hash]
      );
      const token = app.jwt.sign({ userId: rows[0].id }, { expiresIn: "7d" });
      return { token };
    } catch (e: any) {
      if (e.code === "23505") return reply.code(409).send({ error: "Email already registered" });
      throw e;
    }
  });

  app.post("/auth/login", async (req, reply) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return reply.code(400).send({ error: "Email and password required" });
    const { rows } = await pool.query(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    const ok = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
    if (!ok) return reply.code(401).send({ error: "Invalid credentials" });
    const token = app.jwt.sign({ userId: rows[0].id }, { expiresIn: "7d" });
    return { token };
  });
}
