import "dotenv/config";
import Fastify from "fastify";
import { pool } from "./db.js";

const app = Fastify({ logger: true });

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok" };
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
