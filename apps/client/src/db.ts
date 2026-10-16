import Dexie, { type Table } from "dexie";
import type { Op } from "@synclist/crdt";

export interface StoredOp extends Op { groupId: string }
export interface Meta { key: string; value: unknown }

class LocalDb extends Dexie {
  ops!: Table<StoredOp, [string, string]>;
  outbox!: Table<StoredOp, [string, string]>;
  meta!: Table<Meta, string>;

  constructor() {
    super("synclist");
    this.version(1).stores({
      ops: "[groupId+opId], groupId",
      outbox: "[groupId+opId], groupId",
      meta: "key",
    });
  }
}

export const db = new LocalDb();
