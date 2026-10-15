# SyncList Wireframes

## Screen 1: Login / Signup
```
+--------------------------------+
|           SyncList             |
|                                |
|  Email    [__________________] |
|  Password [__________________] |
|                                |
|  [ Log in ]    [ Sign up ]     |
+--------------------------------+
```
- Errors show under the fields.

## Screen 2: My Groups
```
+--------------------------------+
|  My Lists               [Logout]|
|--------------------------------|
|  > Home Groceries       (3 ppl) |
|  > Trip Packing List    (2 ppl) |
|                                |
|  [ + New list ]  [ Join code ] |
+--------------------------------+
```
- New list asks for a name and shows a join code to share.
- Join code asks for a code from a friend.

## Screen 3: List view (main screen)
```
+--------------------------------+
|  < Home Groceries    [* Synced] |
|--------------------------------|
|  [!] Offline: changes saved     |
|      locally, will sync later   |
|--------------------------------|
|  [x] Milk              qty 2  X |
|  [ ] Eggs              qty 12 X |
|  [ ] Bread             qty 1  X |
|                                |
|  [ Add item...      ] [ Add ]  |
+--------------------------------+
```
- Tap a name or qty to edit (creates a `set` op).
- X deletes (creates a `delete` op).
- Checkbox is a `checked` field (a `set` op).

## Sync status indicator (top right)
| State | Label |
|---|---|
| Online, nothing pending | * Synced |
| Online, sending | ~ Syncing... |
| Offline | ! Offline (N pending) |

- N = number of ops in the local queue not yet sent.
- The offline banner appears only when offline.

## Demo screen (for the final presentation)
- A "simulate offline" toggle per device tab, so the conflict demo works on one laptop.
- Optional debug panel showing the version vector and pending count.