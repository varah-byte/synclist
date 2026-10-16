import { useEffect, useState } from "react";
import { createOp, loadItems } from "./store";

const GROUP = "demo-group";

export default function App() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");

  const refresh = async () => setItems(await loadItems(GROUP));
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    await createOp(GROUP, { type: "add", itemId: crypto.randomUUID(), value: name.trim() });
    setName("");
    refresh();
  };

  const remove = async (id: string) => {
    await createOp(GROUP, { type: "delete", itemId: id });
    refresh();
  };

  const rename = async (id: string) => {
    const v = prompt("New name?");
    if (v) { await createOp(GROUP, { type: "set", itemId: id, field: "name", value: v }); refresh(); }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>SyncList (local only)</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add item..." />
      <button onClick={add}>Add</button>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {i.name} <button onClick={() => rename(i.id)}>Rename</button>
            <button onClick={() => remove(i.id)}>X</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
