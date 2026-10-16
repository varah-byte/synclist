CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  join_code  TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Append-only. Never UPDATE or DELETE rows.
CREATE TABLE ops_log (
  log_id      BIGSERIAL PRIMARY KEY,          -- arrival order
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  op_id       TEXT NOT NULL,                  -- "deviceId-seq"
  device_id   TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  hlc_wall    BIGINT NOT NULL,
  hlc_counter INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('add','set','delete')),
  item_id     TEXT NOT NULL,
  field       TEXT,
  value       JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, op_id)                    -- server-side dedup (S5)
);
CREATE INDEX ops_log_group_dev_seq ON ops_log (group_id, device_id, seq);

CREATE TABLE snapshots (
  id         BIGSERIAL PRIMARY KEY,
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  up_to_log  BIGINT NOT NULL,                 -- last log_id included
  state      JSONB NOT NULL,                  -- full CRDT State
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);