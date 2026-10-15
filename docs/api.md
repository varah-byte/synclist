# SyncList API (v1)

Auth: `Authorization: Bearer <JWT>` on everything except signup/login.

| Method | Path | Purpose |
|---|---|---|
| POST | /auth/signup | `{email, password}` -> `{token}` |
| POST | /auth/login | `{email, password}` -> `{token}` |
| POST | /groups | `{name}` -> `{id, joinCode}` |
| POST | /groups/join | `{joinCode}` -> `{id}` |
| GET | /groups | list my groups |
| POST | /groups/:id/sync | batch sync (below) |
| WS | /groups/:id/subscribe?token=JWT | server pushes new ops |
| GET | /health | liveness check |

## POST /groups/:id/sync (idempotent)
Request:
```json
{
  "ops": [ /* Op[] the client created offline */ ],
  "vv": { "device-A": 12, "device-B": 4 }
}
```
Server steps:
1. Check the user is a group member.
2. `INSERT ... ON CONFLICT (group_id, op_id) DO NOTHING` for each op.
3. Broadcast newly inserted ops to WebSocket subscribers.
4. Return all ops the client lacks, ordered by `log_id`.

Response:
```json
{ "ops": [ /* Op[] with seq > vv[device] */ ], "serverLogId": 981 }
```
Safe to retry. Same request twice gives the same result.

## WS messages (server -> client)
`{ "type": "ops", "ops": [ ... ] }`
Client applies them with `applyOp`.