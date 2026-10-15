# SyncList Sync Protocol (v1)

## 1. Goal
All replicas that receive the same set of operations reach the same list state,
regardless of delivery order or duplicate delivery.

## 2. Operation (immutable)
| Field | Meaning |
|---|---|
| opId | `deviceId-seq`, globally unique |
| deviceId | Device that created the op |
| seq | Per-device counter, starts at 1, no gaps |
| hlc | `{ wall, counter }` Hybrid Logical Clock |
| type | `add`, `set`, or `delete` |
| itemId | UUID of the item. Never derived from content |
| field | Field name (`set` only) |
| value | Initial name (`add`) or new field value (`set`) |

## 3. Clock (HLC)
- Order: higher `wall`, then higher `counter`.
- Local event: `wall = max(now, last.wall)`. If wall is unchanged, `counter + 1`, else `0`.
- On receive: `wall = max(now, last.wall, remote.wall)`. Counter is bumped so the result exceeds both clocks.
- The clock never moves backwards.

## 4. State
- `items`: itemId -> { fields, deleted }
- Each field is a register: `{ value, hlc, deviceId }`
- `vv` (version vector): deviceId -> highest contiguous seq applied
- `pending`: ops buffered until their dependencies arrive

## 5. Merge rules
1. **Duplicate:** if `seq <= vv[deviceId]`, ignore the op (at-most-once).
2. **Ready:** an op is applied only if
   - `seq == vv[deviceId] + 1` (no gap), and
   - for `set` and `delete`, the item is already known.
   Otherwise it waits in `pending` and is retried after every applied op.
3. **add:** creates the item. If the itemId already exists, ignore. Items are never merged by name.
4. **set:** field register keeps the value with the higher `(hlc, deviceId)`.
   Different fields are independent, so both edits survive.
5. **delete:** sets a tombstone (remove-wins).
   - `set` on a tombstoned item is ignored.
   - A tombstoned item is never revived.
   - A re-added "same name" item is a new item with a new itemId.

## 6. Why it converges
- A register update takes the maximum under the total order `(hlc, deviceId)`.
  The result does not depend on order or repetition.
- `delete` only moves `deleted` from false to true, so it cannot be undone.
- Per-device ops are applied in seq order, and `pending` guarantees dependencies come first.
- Therefore, any replicas holding the same op set have the same state.
- Evidence: property-based tests (shuffle, duplicate, split-merge).

## 7. Scenario coverage
S1, S5, S6, S7 are covered by the rules above (S1/S7 by rule 5, S5 by rule 1, S6 by rule 2). S2 is covered by rule 3, and S3/S4 by rule 4.

## 8. Server role
- Append-only op log in Postgres, ordered by arrival.
- Accepts batches, deduplicates by opId, and relays ops over WebSocket.
- Does not resolve conflicts. Clients apply the merge rules.
- Client sync request: "send ops I haven't seen" using its `vv`.

## 9. Known limitations (planned)
- **Ordering:** items are sorted by id for now. Fractional position IDs are planned.
- **Tombstone compaction:** tombstones are kept forever for now. Compaction is allowed only after all known devices acknowledge.
- **pending buffer:** unbounded for now. A size limit or resync fallback is planned.
- **Auth and clock trust:** not validated yet. JWT plus HLC drift limits are planned.