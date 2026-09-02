"use client";

import { useEffect, useState } from "react";

const SETTINGS_KEY = "app_settings";

type Settings = {
  colorMode: "tw" | "intl"; // tw=紅漲綠跌, intl=綠漲紅跌
};

const defaults: Settings = { colorMode: "tw" };

function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    return s ? { ...defaults, ...s } : defaults;
  } catch {
    return defaults;
  }
}

function save(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
  // Apply color mode to root
  document.documentElement.setAttribute("data-color-mode", s.colorMode);
}

export function applySettings() {
  if (typeof window === "undefined") return;
  const s = load();
  document.documentElement.setAttribute("data-color-mode", s.colorMode);
}

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    setSettings(load());
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    save(next);
  };

  return (
    <>
      <div className="tool-card">
        <div className="tool-title">漲跌顏色慣例</div>
        <div className="calc-form">
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 0" }}>
            <input type="radio" name="colorMode" checked={settings.colorMode === "tw"} onChange={() => update({ colorMode: "tw" })} />
            <span className="up" style={{ fontWeight: 600 }}>紅漲</span> / <span className="down" style={{ fontWeight: 600 }}>綠跌</span>（台灣慣例）
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 0" }}>
            <input type="radio" name="colorMode" checked={settings.colorMode === "intl"} onChange={() => update({ colorMode: "intl" })} />
            <span style={{ color: "var(--green)", fontWeight: 600 }}>綠漲</span> / <span style={{ color: "var(--red)", fontWeight: 600 }}>紅跌</span>（國際慣例）
          </label>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>切換後全站漲跌顏色立即變更。此設定存於瀏覽器。</div>
      </div>

      <div className="tool-card">
        <div className="tool-title">到價提醒</div>
        <PriceAlerts />
      </div>
    </>
  );
}

// ── 到價提醒（localStorage-based） ──
const ALERTS_KEY = "price_alerts";
type Alert = { id: string; sid: string; dir: "above" | "below"; price: number; active: boolean };

function PriceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [form, setForm] = useState({ sid: "", dir: "above" as "above" | "below", price: "" });

  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]");
      if (Array.isArray(a)) setAlerts(a);
    } catch {}
  }, []);

  const persist = (next: Alert[]) => {
    setAlerts(next);
    try { localStorage.setItem(ALERTS_KEY, JSON.stringify(next)); } catch {}
  };

  const add = () => {
    const sid = form.sid.trim();
    const price = parseFloat(form.price);
    if (!sid || !Number.isFinite(price) || price <= 0) return;
    const a: Alert = { id: Date.now().toString(36), sid, dir: form.dir, price, active: true };
    persist([...alerts, a]);
    setForm({ sid: "", dir: "above", price: "" });
  };

  const toggle = (id: string) => persist(alerts.map((a) => a.id === id ? { ...a, active: !a.active } : a));
  const remove = (id: string) => persist(alerts.filter((a) => a.id !== id));

  return (
    <>
      <div className="hint" style={{ marginBottom: 8 }}>
        設定到價提醒，當股價觸及目標價時在自選股頁面提示。資料存於瀏覽器。
      </div>
      <div className="controls" style={{ marginBottom: 10 }}>
        <input value={form.sid} onChange={(e) => setForm((f) => ({ ...f, sid: e.target.value }))} placeholder="股號（如 2330）" aria-label="股號"
          style={{ padding: "7px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5, width: 120 }} />
        <select value={form.dir} onChange={(e) => setForm((f) => ({ ...f, dir: e.target.value as "above" | "below" }))}
          style={{ padding: "7px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5 }}>
          <option value="above">漲破</option>
          <option value="below">跌破</option>
        </select>
        <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="目標價" aria-label="目標價"
          style={{ padding: "7px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5, width: 120 }} />
        <button type="button" className="btn" onClick={add}>新增提醒</button>
      </div>
      {alerts.length === 0 ? (
        <div className="empty-msg">尚無到價提醒。</div>
      ) : (
        <div className="table-wrap">
          <table style={{ fontSize: 12.5 }}>
            <thead>
              <tr><th>股號</th><th>條件</th><th className="num">目標價</th><th>狀態</th><th /></tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} style={{ opacity: a.active ? 1 : 0.5 }}>
                  <td>{a.sid}</td>
                  <td>{a.dir === "above" ? "漲破 ≥" : "跌破 ≤"}</td>
                  <td className="num">{a.price}</td>
                  <td>
                    <button type="button" className={`toggle-chip ${a.active ? "on" : ""}`} onClick={() => toggle(a.id)}>
                      {a.active ? "啟用" : "暫停"}
                    </button>
                  </td>
                  <td><button type="button" className="btn-reset" onClick={() => remove(a.id)}>刪除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
