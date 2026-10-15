# SyncList Architecture

## System overview

```mermaid
flowchart LR
  subgraph Devices
    C1["Client A<br/>React PWA<br/>IndexedDB + CRDT engine"]
    C2["Client B<br/>React PWA<br/>IndexedDB + CRDT engine"]
    C3["Client C<br/>React PWA<br/>IndexedDB + CRDT engine"]
  end

  subgraph Azure
    ING["NGINX Ingress<br/>(AKS)"]
    subgraph AKS["AKS cluster"]
      S1["Sync server pod<br/>Fastify + ws"]
      S2["Sync server pod<br/>Fastify + ws"]
      PROM["Prometheus"]
      GRAF["Grafana"]
    end
    DB[("Azure PostgreSQL<br/>ops_log + snapshots")]
    ACR["Azure Container Registry"]
    MON["Azure Monitor"]
  end

  C1 <-->|"HTTPS /sync, WSS"| ING
  C2 <-->|"HTTPS /sync, WSS"| ING
  C3 <-->|"HTTPS /sync, WSS"| ING
  ING --> S1
  ING --> S2
  S1 --> DB
  S2 --> DB
  PROM -->|scrape /metrics| S1
  PROM -->|scrape /metrics| S2
  GRAF --> PROM
  ACR -.->|image pull| AKS
  AKS -.-> MON
```

## Sync flow (offline edit, then reconnect)

```mermaid
sequenceDiagram
  participant A as Client A
  participant S as Server
  participant D as Postgres
  participant B as Client B

  Note over A: Offline: edits saved to IndexedDB as ops
  A->>S: POST /sync {ops, vv}
  S->>D: INSERT ... ON CONFLICT DO NOTHING
  S-->>B: WS push {ops}
  B->>B: applyOp (merge locally)
  S-->>A: {ops A lacks}
  A->>A: applyOp (merge locally)
  Note over A,B: Same ops, same state
```

## Key points
- Clients merge. The server only stores and relays ops.
- Two server pods: any pod can serve any client, since all state is in Postgres.
- Cross-pod WebSocket broadcast needs a mechanism (Postgres `LISTEN/NOTIFY`). Planned for Phase 4.