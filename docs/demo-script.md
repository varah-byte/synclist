# Live Demo Script (about 5 minutes)

## Before the demo
- `az aks start --resource-group synclist-rg --name synclist-aks` (5 min), then `kubectl get service synclist-server` and confirm the IP matches `sync.ts`
- Client running (`npm run dev` in apps/client)
- Two windows side by side: normal (user A) and Incognito (user B), same list
- Second client prepared with the join code

## Script
1. **Show it live:** add "Milk" in A. It appears in B within a second.
2. **Go offline:** click "Simulate offline" in A. Banner appears.
3. **Conflict 1 (edit vs delete):** in A rename "Milk" to "Oat Milk". In B delete "Milk".
4. **Conflict 2 (same field):** add "Eggs" in B, rename it in B to "Eggs 12". In A (offline) add its own "Bread".
5. **Duplicate:** click "Sync now" twice in A after reconnecting (shows sent 0).
6. **Reconnect:** click "Go online" in A.
7. **Result:** both windows show the identical list. Milk is deleted (remove-wins), Eggs and Bread both survive.
8. **Show evidence:** `docs/evaluation.md`, the 19 passing tests, the k6 and convergence numbers.

## Talking points
- No server arbitration: clients apply deterministic merge rules
- Same operation twice has no effect
- Edit vs delete: delete wins, nothing resurrects
- Property tests shuffle and duplicate thousands of operations

## After the demo
`az group delete --name synclist-rg --yes --no-wait`
