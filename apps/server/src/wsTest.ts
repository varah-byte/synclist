import WebSocket from "ws";
const [, , gid, token] = process.argv;
const ws = new WebSocket(`ws://localhost:3000/groups/${gid}/subscribe?token=${token}`);
ws.on("message", (m) => console.log("RECEIVED:", m.toString()));
ws.on("close", (c, r) => console.log("closed", c, r.toString()));
