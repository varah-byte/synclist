import { useCallback, useEffect, useState } from "react";
import { createOp, loadItems, pendingCount } from "./store";
import { api, syncGroup, connectLive, net } from "./sync";
import "./App.css";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") ?? "");
  const [groupId, setGroupId] = useState(localStorage.getItem("groupId") ?? "");
  const [email, setEmail] = useState("a@test.com");
  const [password, setPassword] = useState("secret123");
  const [groupName, setGroupName] = useState("");
  const [listName, setListName] = useState(localStorage.getItem("listName") ?? "My shared list");
  const [joinCode, setJoinCode] = useState("");
  const [items, setItems] = useState<Awaited<ReturnType<typeof loadItems>>>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [offline, setOffline] = useState(net.offline);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const refresh = useCallback(async () => {
    if (!groupId) return;
    setItems(await loadItems(groupId));
    setPending(await pendingCount(groupId));
  }, [groupId]);
  useEffect(() => {
    if (!groupId) return;
    let active = true;
    Promise.all([loadItems(groupId), pendingCount(groupId)]).then(([saved, count]) => {
      if (active) { setItems(saved); setPending(count); }
    }).catch(() => { if (active) setMsg("Error: Unable to load your saved list."); });
    return () => { active = false; };
  }, [groupId]);
  useEffect(() => {
    if (!token || !groupId) return;
    const close = connectLive(groupId, token, refresh);
    const onOnline = () => syncGroup(groupId, token).then(refresh).catch(() => {});
    window.addEventListener("online", onOnline);
    return () => { close(); window.removeEventListener("online", onOnline); };
  }, [token, groupId, refresh]);

  const autoSync = () => {
    if (token && groupId) syncGroup(groupId, token).then(refresh).catch(() => {});
  };
  const wrap = async (f: () => Promise<void>) => {
    setBusy(true); setMsg("");
    try { await f(); } catch (e: unknown) { setMsg("Error: " + (e instanceof Error ? e.message : "Something went wrong. Please try again.")); }
    finally { setBusy(false); }
  };
  const selectGroup = (id: string, title: string) => {
    localStorage.setItem("groupId", id); localStorage.setItem("listName", title);
    setItems([]); setPending(0); setQuery(""); setEditing(null); setGroupId(id); setListName(title);
  };
  const login = () => wrap(async () => {
    const r = await api("/auth/login", null, { email, password });
    localStorage.setItem("token", r.token); setToken(r.token);
  });
  const createGroup = () => wrap(async () => {
    const r = await api("/groups", token, { name: groupName.trim() });
    selectGroup(r.id, groupName.trim()); setMsg("Invite someone with your join code: " + r.joinCode);
  });
  const join = () => wrap(async () => {
    const r = await api("/groups/join", token, { joinCode: joinCode.trim() });
    selectGroup(r.id, r.name || "My shared list"); setMsg("You're in. Make this list your own.");
  });
  const sync = () => wrap(async () => {
    const r = await syncGroup(groupId, token);
    setMsg(`Sync complete. ${r.sent} changes sent, ${r.received} received.`); await refresh();
  });
  const add = () => wrap(async () => {
    if (!name.trim()) return;
    const maxPos = items.reduce((m, i) => Math.max(m, typeof i.pos === "number" ? i.pos : 0), 0);
    const id = crypto.randomUUID();
    await createOp(groupId, { type: "add", itemId: id, value: name.trim() });
    await createOp(groupId, { type: "set", itemId: id, field: "pos", value: maxPos + 1 });
    setName(""); await refresh(); autoSync();
  });
  const remove = (id: string) => wrap(async () => {
    await createOp(groupId, { type: "delete", itemId: id });
    await refresh(); autoSync();
  });
  const rename = (id: string) => wrap(async () => {
    if (!draft.trim()) return;
    await createOp(groupId, { type: "set", itemId: id, field: "name", value: draft.trim() });
    setEditing(null); await refresh(); autoSync();
  });
  const visible = items.filter(i => String(i.name).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="SyncList home"><span className="brand-mark" aria-hidden="true">?</span>SyncList<span className="brand-dot">.</span></a>
        <span className="topbar-note">A little less to keep in mind.</span>
        {token && <button className="text-button" onClick={() => { localStorage.removeItem("token"); setToken(""); setMsg(""); }}>Sign out <span aria-hidden="true">?</span></button>}
      </header>
      <main className={token && groupId ? "workspace" : "welcome"}>
        {!token ? <>
          <section className="intro"><span className="eyebrow">LESS FRICTION. MORE TOGETHER.</span><h1>Life moves.<br />Your lists keep up.</h1><p>A shared space for the little things.<br />Add, edit, and stay in sync—even offline.</p><div className="feature-note"><span className="status-dot" /> Saved locally. Shared effortlessly.</div></section>
          <section className="panel auth-panel"><span className="eyebrow">YOUR EVERYDAY, ORGANIZED</span><h2>Welcome back</h2><p className="muted">Sign in to pick up where you left off.</p><form onSubmit={e => { e.preventDefault(); login(); }}><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button className="primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<span aria-hidden="true">?</span></button></form><p className="form-note">One list. Everyone on the same page.</p></section>
        </> : !groupId ? <>
          <section className="intro"><span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span><h1>Good things<br />start with a list.</h1><p>Groceries, weekend plans, the next big idea.<br />Create a list or join your people.</p><div className="feature-note"><span className="status-dot" /> Built to stay together.</div></section>
          <section className="panel auth-panel"><h2>Your next list</h2><p className="muted">A fresh start, or a familiar space.</p><form onSubmit={e => { e.preventDefault(); createGroup(); }}><label>Start something new<input placeholder="e.g. Our weekly groceries" required value={groupName} onChange={e => setGroupName(e.target.value)} /></label><button className="primary full" disabled={busy || !groupName.trim()}>Create a list <span aria-hidden="true">+</span></button></form><div className="divider"><span>or join an existing list</span></div><form onSubmit={e => { e.preventDefault(); join(); }}><label>Invite code<input placeholder="Enter your join code" required value={joinCode} onChange={e => setJoinCode(e.target.value)} /></label><button className="secondary full" disabled={busy || !joinCode.trim()}>Join list <span aria-hidden="true">?</span></button></form></section>
        </> : <>
          <div className="workspace-heading"><div><span className="eyebrow">YOUR SHARED SPACE</span><h1>{listName}</h1><p className="muted">Little things, all in one place.</p></div><button className="secondary" disabled={busy} onClick={() => { localStorage.removeItem("groupId"); setGroupId(""); setMsg(""); }}>Switch list <span aria-hidden="true">?</span></button></div>
          <div className="workspace-grid"><section className="panel list-panel" aria-label="List items">
            <div className="list-toolbar"><h2>The list <span className="count">{items.length}</span></h2><label className="search"><span className="sr-only">Search items</span><input type="search" placeholder="Search items…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
            <form className="add-form" onSubmit={e => { e.preventDefault(); add(); }}><span aria-hidden="true">+</span><label className="sr-only" htmlFor="new-item">New item</label><input id="new-item" placeholder="What needs to go on the list?" value={name} onChange={e => setName(e.target.value)} /><button className="primary" disabled={busy || !name.trim()}>Add item</button></form>
            {visible.length ? <ul className="items">{visible.map((item, index) => <li key={item.id} className="item"><span className="item-number">{String(index + 1).padStart(2, "0")}</span>{editing === item.id ? <form className="edit-form" onSubmit={e => { e.preventDefault(); rename(item.id); }}><input aria-label="Item name" autoFocus value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setEditing(null); }} /><button className="text-button" disabled={busy || !draft.trim()}>Save</button><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button></form> : <><span className="item-name">{String(item.name)}</span><div className="item-actions"><button className="text-button" disabled={busy} aria-label={`Rename ${item.name}`} onClick={() => { setEditing(item.id); setDraft(String(item.name)); }}>Edit</button><button className="delete-button" disabled={busy} aria-label={`Remove ${item.name}`} onClick={() => remove(item.id)}>×</button></div></>}</li>)}</ul> : <div className="empty-state"><span className="empty-icon" aria-hidden="true">{query ? "?" : "?"}</span><h3>{query ? "No matches just yet" : "A little space for everything"}</h3><p>{query ? "Try another search, or add something new." : "Add your first item above. The rest will follow."}</p>{query && <button className="text-button" onClick={() => setQuery("")}>Clear search</button>}</div>}
            <div className="list-footer"><span>{items.length} {items.length === 1 ? "item" : "items"}{query && ` · ${visible.length} shown`}</span><span>Made for sharing</span></div>
          </section><aside className="sidebar"><section className="panel sync-panel"><span className="eyebrow">ALWAYS WITH YOU</span><div className={`sync-status ${offline || pending ? "waiting" : ""}`} role="status"><span className="status-dot" />{offline ? "Working offline" : pending ? `${pending} changes pending` : "No pending changes"}</div><p>{offline ? "Keep going. Your edits are saved on this device and will sync when you go online." : "Your list saves on this device. Sync to bring everyone up to date."}</p><button className="secondary full" disabled={busy || offline} onClick={sync}>{busy ? "Working…" : "Sync now"}<span aria-hidden="true">?</span></button><div className="offline-control"><label htmlFor="offline-toggle">Simulate offline</label><button id="offline-toggle" className={`toggle ${offline ? "on" : ""}`} role="switch" aria-checked={offline} aria-label="Simulate offline" disabled={busy} onClick={() => { net.offline = !net.offline; setOffline(net.offline); if (!net.offline) autoSync(); }}><span /></button></div></section><div className="side-note"><span aria-hidden="true">?</span><p>Different places.<br />Same page.</p><small>Changes merge automatically,<br />so you can keep moving.</small></div></aside></div>
        </>}
        {msg && <div className={`notice ${msg.startsWith("Error:") ? "error" : ""}`} role={msg.startsWith("Error:") ? "alert" : "status"}><span>{msg}</span><button className="text-button" aria-label="Dismiss message" onClick={() => setMsg("")}>×</button></div>}
      </main><footer className="page-footer"><span>Less to remember. More to do.</span><span>SyncList · Together, in sync.</span></footer>
    </div>
  );
}
