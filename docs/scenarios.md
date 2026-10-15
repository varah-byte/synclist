# SyncList Conflict Scenarios

## S1 — Edit vs delete

- **Setup:** List has item "Milk" (itemId = m1)
- **Actions:**
  - Device A (offline): renames m1 to "Oat Milk"
  - Device B (offline): deletes m1
- **Expected result:** Item is deleted on both devices (remove-wins). The rename is discarded.

## S2 — Duplicate item names

- **Setup:** Empty list
- **Actions:**
  - Device A (offline): adds item "Eggs" (itemId = a1)
  - Device B (offline): adds item "Eggs" (itemId = b1)
- **Expected result:** Both devices show 2 items named "Eggs" (a1 and b1). No merging by name, because IDs are unique. Order is decided by position ID, with deviceId as tie-break.

## S3 — Concurrent renames

- **Setup:** List has item "Milk" (itemId = m1)
- **Actions:**
  - Device A (offline): renames m1 to "Oat Milk" (HLC = 105, deviceId = A)
  - Device B (offline): renames m1 to "Soy Milk" (HLC = 107, deviceId = B)
- **Expected result:** Both devices show 1 item named "Soy Milk". Higher HLC wins. If the HLCs were equal, the higher deviceId would win. The result is the same in any arrival order.

## S4 — Concurrent edits to different fields

- **Setup:** List has item "Milk" (itemId = m1), quantity = 1
- **Actions:**
  - Device A (offline): changes m1 quantity to 2 (HLC = 105)
  - Device B (offline): renames m1 to "Oat Milk" (HLC = 107)
- **Expected result:** Both devices show 1 item: name "Oat Milk", quantity 2. Each field has its own register, so both edits survive.

## S5 — Duplicate operation delivery

- **Setup:** Empty list on both devices
- **Actions:**
  - Device A: adds "Eggs" (itemId = a1, opId = op1) and syncs
  - Device B: receives op1 twice (network retry)
- **Expected result:** Device B shows 1 item "Eggs". The second copy of op1 is ignored, because opId is already seen (version vector). Each op takes effect at most once.

## S6 — Out-of-order operation delivery

- **Setup:** Empty list on both devices
- **Actions:**
  - Device A: adds "Milk" (itemId = m1, op1, seq 1), then renames it to "Oat Milk" (op2, seq 2)
  - Device B: receives op2 first, then op1
- **Expected result:** Device B ends with 1 item "Oat Milk". op2 is held in a buffer until op1 arrives, then both are applied in causal order. The final state matches Device A.

## S7 — Delete and re-add

- **Setup:** List has item "Eggs" (itemId = e1)
- **Actions:**
  - Device A (offline): deletes e1
  - Device B (offline): adds a new item "Eggs" (itemId = e2)
- **Expected result:** Both devices show 1 item "Eggs" (e2). e1 stays deleted (tombstone), so it is not resurrected. e2 is a different item with a new ID, so the delete does not affect it.