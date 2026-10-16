import "dotenv/config";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { pool } from "./db.js";
import { authRoutes, requireAuth } from "./auth.js";
import { groupRoutes } from "./groups.js";

const app = Fastify({ logger: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? "dev-secret" });
await app.register(authRoutes);
await app.register(groupRoutes);

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok" };
});

app.get("/me", { preHandler: requireAuth }, async (req) => ({ userId: req.user.userId }));

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
