import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { isMember } from "./groups.js";

const rooms = new Map<string, Set<WebSocket>>();

export function broadcast(groupId: string, ops: unknown[], except?: WebSocket) {
  if (ops.length === 0) return;
  const msg = JSON.stringify({ type: "ops", ops });
  for (const s of rooms.get(groupId) ?? []) {
    if (s !== except && s.readyState === 1) s.send(msg);
  }
}

export async function realtimeRoutes(app: FastifyInstance) {
  await app.register(websocket);

  app.get("/groups/:id/subscribe", { websocket: true }, async (socket, req) => {
    const { id } = req.params as { id: string };
    const { token } = req.query as { token?: string };

    let userId: string;
    try {
      userId = (app.jwt.verify(token ?? "") as { userId: string }).userId;
    } catch {
      socket.close(4401, "Unauthorized");
      return;
    }
    if (!(await isMember(id, userId))) {
      socket.close(4403, "Not a member");
      return;
    }

    if (!rooms.has(id)) rooms.set(id, new Set());
    rooms.get(id)!.add(socket);
    socket.send(JSON.stringify({ type: "hello" }));

    socket.on("close", () => {
      rooms.get(id)?.delete(socket);
      if (rooms.get(id)?.size === 0) rooms.delete(id);
    });
  });
}
