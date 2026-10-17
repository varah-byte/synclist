# SyncList Evaluation

## 1. Setup
- Client: React PWA, IndexedDB (Dexie), self-built CRDT engine (TypeScript)
- Server: Fastify + WebSocket, PostgreSQL append-only op log
- Deployment: Azure Kubernetes Service (Central India), 1 node (Standard_B2s_v2), 1 server pod, 1 Postgres pod, Azure Container Registry
- CI: GitHub Actions (CRDT tests, integration test, client build); image build and push to ACR

## 2. Success criteria

| # | Criterion | Evidence | Result |
|---|---|---|---|
| 1 | Identical final state on all replicas | 19 unit and property tests; 3-client integration test through the server; network-fault test | PASS |
| 2 | Each operation takes effect at most once | Duplicate-delivery property test; repeated sync rounds in the integration test; server UNIQUE(group_id, op_id) | PASS |
| 3 | Convergence within 5 seconds | 30 samples against Azure: min=35 ms, median=41 ms, p95=49 ms, max=54 ms | PASS |
| 4 | Backend available under concurrent load | k6, up to 20 concurrent users, 824 requests, 0% failed | PASS |

## 3. Correctness testing
- 7 conflict scenarios (S1 to S7), each encoded as a unit test
- 3 property-based tests (fast-check, hundreds of random cases each): any delivery order, duplicate delivery, and split-and-merge in opposite order all give the same state
- Integration test: 3 clients make conflicting offline edits (rename vs delete vs add), sync in shuffled order with repeated rounds, and all end identical

## 4. Convergence time
Edit on client A, measured until it arrives at client B over WebSocket, against the deployed Azure server, 30 samples.

| min | median | p95 | max | Target |
|---|---|---|---|---|
| 35 ms | 41 ms | 49 ms | 54 ms | under 5000 ms |

Note: this measures steady-state propagation between two online clients. After an offline period, convergence time is dominated by the time to reconnect plus one sync round trip.

## 5. Load test (k6, against Azure)

| | Run 1: vv empty (worst case) | Run 2: realistic vv |
|---|---|---|
| Peak virtual users | 30 | 20 |
| Requests | 930 | 824 |
| Failed | 0% | 0% |
| Median latency | 167 ms | 90 ms |
| p95 latency | 1.49 s | 173 ms |
| Data received | 59 MB | 2.2 MB |

Run 1 returned the entire op log on every request, so responses grew during the test and the p95 threshold (under 1 s) was crossed. Run 2 sends the client's version vector, so only missing ops are returned: about 27x less data and about 9x lower p95, with all thresholds passing. This shows why version vectors matter.

## 6. Network-fault test
A local fault-injecting proxy sat between 3 clients and the server, adding up to 200 ms random delay, dropping 30% of requests, and simulating a full partition.
- During the partition, clients kept editing locally; no sync succeeded and no edits were lost
- Under lossy conditions: 120 sync attempts, 35 dropped (29%). Retries were safe because sync is idempotent
- After recovery, all 3 replicas converged to the same 15 items

## 7. Limitations
- Single server pod; multi-pod WebSocket broadcast would need Postgres LISTEN/NOTIFY
- Tombstones are never compacted and the pending buffer is unbounded
- Item ordering supports append only (no drag-and-drop between items)
- Latency measurements include college Wi-Fi; traffic is HTTP, not HTTPS
- Load test and convergence test ran from a single machine

## 8. Deviations from the synopsis
- AKS, Azure Container Registry and an in-cluster Postgres replace EKS, ECR and RDS
- ACR Tasks was blocked on the student subscription, so GitHub Actions builds the image
- A custom fault-injecting proxy replaced Toxiproxy/Chaos Mesh
- Prometheus, Grafana and OpenTelemetry were not implemented
