import { emptyState, applyOp, visibleItems } from "@synclist/crdt";

function App() {
  const s = applyOp(emptyState(), {
    opId: "dA-1",
    deviceId: "dA",
    seq: 1,
    hlc: { wall: 1, counter: 0 },
    type: "add",
    itemId: "m1",
    value: "Milk",
  });
  return <pre>{JSON.stringify(visibleItems(s), null, 2)}</pre>;
}

export default App;
