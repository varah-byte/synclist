import { useEffect, useState } from "react";
import { createOp, loadItems } from "./store";
import { api, syncGroup } from "./sync";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") ?? "");
  const [groupId, setGroupId] = useState(localStorage.getItem("groupId") ?? "");
  const [email, setEmail] = useState("a@test.com");
  const [password, setPassword] = useState("secret123");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = async () => groupId && setItems(await loadItems(groupId));
  useEffect(() => { refresh(); }, [groupId]);

  const wrap = async (f: () => Promise<void>) => {
    try { await f(); } catch (e: any) { setMsg("Error: " + e.message); }
  };

  const login = () => wrap(async () => {
    const r = await api("/auth/login", null, { email, password });
    localStorage.setItem("token", r.token); setToken(r.token); setMsg("Logged in");
  });
  const createGroup = () => wrap(async () => {
    const r = await api("/groups", token, { name: groupName });
    localStorage.setItem("groupId", r.id); setGroupId(r.id); setMsg("Join code: " + r.joinCode);
  });
  const join = () => wrap(async () => {
    const r = await api("/groups/join", token, { joinCode });
    localStorage.setItem("groupId", r.id); setGroupId(r.id); setMsg("Joined");
  });
  const sync = () => wrap(async () => {
    const r = await syncGroup(groupId, token);
    setMsg(`Synced: sent ${r.sent}, received ${r.received}`); refresh();
  });

  const add = async () => {
    if (!name.trim()) return;
    await createOp(groupId, { type: "add", itemId: crypto.randomUUID(), value: name.trim() });
    setName(""); refresh();
  };
  const remove = async (id: string) => { await createOp(groupId, { type: "delete", itemId: id }); refresh(); };
  const rename = async (id: string) => {
    const v = prompt("New name?");
    if (v) { await createOp(groupId, { type: "set", itemId: id, field: "name", value: v }); refresh(); }
  };

  if (!token) return (
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={login}>Log in</button> <p>{msg}</p>
    </div>
  );

  if (!groupId) return (
    <div style={{ padding: 20 }}>
      <h2>Pick a list</h2>
      <input placeholder="New list name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
      <button onClick={createGroup}>Create</button><br />
      <input placeholder="Join code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
      <button onClick={join}>Join</button> <p>{msg}</p>
    </div>
  );

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>SyncList</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add item..." />
      <button onClick={add}>Add</button> <button onClick={sync}>Sync now</button>
      <button onClick={() => { localStorage.removeItem("groupId"); setGroupId(""); }}>Switch list</button>
      <p>{msg}</p>
      <ul>
        {items.map((i) => (
          <li key={i.id}>{i.name} <button onClick={() => rename(i.id)}>Rename</button>
            <button onClick={() => remove(i.id)}>X</button></li>
        ))}
      </ul>
    </div>
  );
}
