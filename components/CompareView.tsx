"use client";

import { useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

type StockData = {
  stock_id: string; name: string; close: number; change_pct: number; volume: number;
  foreign_consec_days: number; trust_consec_days: number;
  rev_yoy: number | null; rev_mom: number | null;
  pe?: number | null; pb?: number | null; dy?: number | null;
  market_type?: string; industry?: string;
};

const METRICS: { key: keyof StockData; label: string; fmt: (v: unknown) => string; cls?: (v: unknown) => string }[] = [
  { key: "close", label: "收盤價", fmt: (v) => fmt(Number(v), 2) },
  { key: "change_pct", label: "漲跌%", fmt: (v) => `${fmtSigned(Number(v))}%`, cls: (v) => pctClass(Number(v)) },
  { key: "volume", label: "成交量（張）", fmt: (v) => fmt(Number(v), 0) },
  { key: "foreign_consec_days", label: "外資連買日", fmt: (v) => String(Number(v) || 0), cls: (v) => pctClass(Number(v)) },
  { key: "trust_consec_days", label: "投信連買日", fmt: (v) => String(Number(v) || 0), cls: (v) => pctClass(Number(v)) },
  { key: "rev_yoy", label: "營收 YoY%", fmt: (v) => v != null ? `${fmtSigned(Number(v))}%` : "—", cls: (v) => v != null ? pctClass(Number(v)) : "" },
  { key: "rev_mom", label: "營收 MoM%", fmt: (v) => v != null ? `${fmtSigned(Number(v))}%` : "—", cls: (v) => v != null ? pctClass(Number(v)) : "" },
  { key: "industry", label: "產業", fmt: (v) => String(v ?? "—") },
];

export default function CompareView() {
  const [input, setInput] = useState("");
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);

  const addStock = async () => {
    const v = input.trim();
    if (!v || !sb || stocks.length >= 5) return;
    if (stocks.some((s) => s.stock_id === v)) { setInput(""); return; }
    setLoading(true);
    try {
      const isId = /^\d{4,6}$/.test(v);
      const { data } = isId
        ? await sb.from("stock_metrics").select("*").eq("stock_id", v).limit(1)
        : await sb.from("stock_metrics").select("*").ilike("name", `%${v}%`).limit(1);
      if (data?.[0]) {
        setStocks((prev) => [...prev, data[0] as StockData]);
        setInput("");
      }
    } finally {
      setLoading(false);
    }
  };

  const remove = (sid: string) => setStocks((prev) => prev.filter((s) => s.stock_id !== sid));

  return (
    <>
      <div className="controls" style={{ marginBottom: 14 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStock()}
          placeholder="輸入股號或名稱（最多 5 支）"
          aria-label="新增比較"
          style={{ padding: "7px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5, maxWidth: 240 }}
        />
        <button type="button" className="btn" onClick={addStock} disabled={loading || stocks.length >= 5}>
          {loading ? "查詢中..." : "加入比較"}
        </button>
        <span className="hint">{stocks.length}/5</span>
      </div>

      {stocks.length === 0 ? (
        <div className="empty-msg">輸入 2-5 支股票代號開始比較。</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>指標</th>
                {stocks.map((s) => (
                  <th key={s.stock_id} className="num">
                    <Link href={`/stock/${s.stock_id}`}>{s.stock_id}</Link> {s.name}
                    <button type="button" className="btn-reset" onClick={() => remove(s.stock_id)} style={{ marginLeft: 6, fontSize: 11 }}>✕</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  {stocks.map((s) => {
                    const v = s[m.key];
                    return (
                      <td key={s.stock_id} className={`num ${m.cls?.(v) ?? ""}`}>
                        {m.fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
