import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://20.207.86.59";

export const options = {
  stages: [
    { duration: "20s", target: 10 },
    { duration: "40s", target: 20 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export function setup() {
  const email = `load-${Date.now()}@t.com`;
  const s = http.post(`${BASE}/auth/signup`, JSON.stringify({ email, password: "secret123" }),
    { headers: { "Content-Type": "application/json" } });
  const token = s.json("token");
  const g = http.post(`${BASE}/groups`, JSON.stringify({ name: "load" }),
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
  return { token, gid: g.json("id") };
}

// Each virtual user keeps its own version vector, like a real client
let vv = {};

export default function (d) {
  const dev = `k6-${__VU}`;
  const seq = __ITER + 1;
  const op = {
    opId: `${dev}-${seq}`, deviceId: dev, seq,
    hlc: { wall: Date.now(), counter: 0 },
    type: "add", itemId: `${dev}-item-${seq}`, value: "x",
  };
  const r = http.post(`${BASE}/groups/${d.gid}/sync`, JSON.stringify({ ops: [op], vv }),
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${d.token}` } });
  const ok = check(r, { "status 200": (x) => x.status === 200 });
  if (ok) {
    for (const o of r.json("ops")) {
      if (!vv[o.deviceId] || o.seq > vv[o.deviceId]) vv[o.deviceId] = o.seq;
    }
  }
  sleep(1);
}
