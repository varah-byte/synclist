export type OpType = "add" | "set" | "delete";

export interface Op {
  opId: string;
  deviceId: string;
  seq: number;
  hlc: { wall: number; counter: number };
  type: OpType;
  itemId: string;
  field?: string;
  value?: unknown;
}