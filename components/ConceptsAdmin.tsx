"use client";

import { useCallback, useEffect, useState } from "react";
import { authSb, useSession } from "@/lib/auth";
import { FALLBACK_CONCEPTS, type Concept } from "@/lib/concepts";
import LoginForm from "./LoginForm";

const emptyForm: Concept = { key: "", title: "", desc: "", ids: [], tier: 1, up: [], down: [] };

export default function ConceptsAdmin() {
  const { user, loading } = useSession();
  const [list, setList] = useState<Concept[]>([]);
  const [form, setForm] = useState<Concept>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!authSb) return;
    const { data } = await authSb.from("concepts").select("*").order("sort", { ascending: true });
    if (data?.length) {
      setList(
        data.map((c) => ({
          key: String(c.key),
          title: String(c.title),
          desc: String(c.desc || ""),
          ids: (c.ids ?? []).map(String),
          tier: Number(c.tier) || 0,
          up: (c.up ?? []).map(String),
          down: (c.down ?? []).map(String),
        })),
      );
    } else {
      setList(FALLBACK_CONCEPTS);
      setMsg("資料庫尚無題材（顯示靜態表）。儲存任一筆後即建立。");
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return <div className="sk-box"><i /><i /></div>;
  if (!user) return <LoginForm />;

  const save = async () => {
    if (!authSb || !form.key || !form.title) {
      setMsg("key 與 title 必填");
      return;
    }
    setBusy(true);
    setMsg("");
    const row = { ...form, ids: form.ids, up: form.up, down: form.down };
    const { error } = await authSb.from("concepts").upsert(row, { onConflict: "key" });
    setBusy(false);
    if (error) {
      setMsg(`儲存失敗：${error.message}`);
      return;
    }
    setForm(emptyForm);
    setEditing(false);
    await load();
  };

  const remove = async (key: string) => {
    if (!authSb) return;
    const { error } = await authSb.from("concepts").delete().eq("key", key);
    if (error) {
      setMsg(`刪除失敗：${error.message}`);
      return;
    }
    await load();
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          {editing ? `編輯：${form.key}` : "新增題材"}
          <span className="hint">欄位：key（唯一代號）/ title / desc / ids（逗號分隔股號）/ tier（0上游 1中游 2下游）/ up / down / sort</span>
        </div>
        <div className="filter-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <div className="filter-group">
            <label>Key</label>
            <input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.trim() }))} placeholder="如 ai_server" style={inputStyle} />
          </div>
          <div className="filter-group">
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="如 AI 伺服器" style={inputStyle} />
          </div>
          <div className="filter-group">
            <label>Tier</label>
            <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: Number(e.target.value) }))} style={inputStyle}>
              <option value={0}>0 上游</option>
              <option value={1}>1 中游</option>
              <option value={2}>2 下游</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Sort</label>
            <input type="number" value={form.sort ?? 0} onChange={(e) => setForm((f) => ({ ...f, sort: Number(e.target.value) }))} style={inputStyle} />
          </div>
          <div className="filter-group" style={{ gridColumn: "1/-1" }}>
            <label>Desc</label>
            <input value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="題材說明" style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div className="filter-group">
            <label>IDs（逗號分隔）</label>
            <input value={form.ids.join(",")} onChange={(e) => setForm((f) => ({ ...f, ids: e.target.value.split(/[,，\s]+/).filter(Boolean) }))} placeholder="2330,3711,2449" style={inputStyle} />
          </div>
          <div className="filter-group">
            <label>Up（上游 key，逗號分隔）</label>
            <input value={form.up.join(",")} onChange={(e) => setForm((f) => ({ ...f, up: e.target.value.split(/[,，\s]+/).filter(Boolean) }))} placeholder="cowos,memory" style={inputStyle} />
          </div>
          <div className="filter-group">
            <label>Down（下游 key）</label>
            <input value={form.down.join(",")} onChange={(e) => setForm((f) => ({ ...f, down: e.target.value.split(/[,，\s]+/).filter(Boolean) }))} placeholder="ai_server,robot" style={inputStyle} />
          </div>
        </div>
        <div className="filter-actions">
          <button type="button" className="btn-filter" onClick={save} disabled={busy}>
            {busy ? "儲存中..." : editing ? "儲存修改" : "新增"}
          </button>
          {editing && (
            <button type="button" className="btn-reset" onClick={() => { setForm(emptyForm); setEditing(false); }}>
              取消
            </button>
          )}
          {msg && <span className="hint" style={{ color: "var(--red)" }}>{msg}</span>}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Title</th>
              <th>Tier</th>
              <th className="num">檔數</th>
              <th>Up / Down</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.key}>
                <td className="num">{c.key}</td>
                <td>{c.title}</td>
                <td>{c.tier}</td>
                <td className="num">{c.ids.length}</td>
                <td className="hint">{c.up.join(",") || "—"} / {c.down.join(",") || "—"}</td>
                <td>
                  <button type="button" className="btn-reset" onClick={() => { setForm(c); setEditing(true); }}>
                    編輯
                  </button>{" "}
                  <button type="button" className="btn-reset" onClick={() => remove(c.key)}>
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const inputStyle = { width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-mono)" } as const;
