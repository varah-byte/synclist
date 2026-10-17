# SyncList: Conflict-Free Offline-First Shared Lists

Shared lists that work offline. Edits merge automatically using a self-built CRDT, with no central lock and no lost edits.

## How it works
- Every user action is an immutable operation (opId, deviceId, seq, HLC timestamp).
- Per-field last-writer-wins registers, remove-wins deletes (tombstones), and a version vector for deduplication and ordering.
- Clients merge locally. The server only stores and relays operations.

## Repo layout
- `packages/crdt`: CRDT engine, unit and property-based tests
- `apps/server`: Fastify + WebSocket + PostgreSQL op log
- `apps/client`: React PWA with IndexedDB
- `docs`: scenarios, protocol, API, architecture, wireframes, evaluation
- `k8s`: Kubernetes manifest (secrets git-ignored)
- `loadtest`: k6 script

## Run locally
1. `docker start synclist-db` (or create it, see docs)
2. `cd apps/server`, then `npm run dev`
3. `cd apps/client`, then `npm run dev`, and open http://localhost:5173
4. Set `API` and `WS` in `apps/client/src/sync.ts` to localhost or the Azure IP

## Tests
- `cd packages/crdt` then `npx vitest run` (19 tests)
- `cd apps/server` then `npx vitest run src/integration.test.ts`
- `k6 run loadtest/sync.js`

See `docs/evaluation.md` for results.
