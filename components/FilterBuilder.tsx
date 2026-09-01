"use client";

import { useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

const COLS = [
  { key: "stock_id", label: "股號", num: false },
  { key: "name", label: "名稱", num: false },
  { key: "close", label: "收盤價", num: true },
  { key: "change_pct", label: "漲跌%", num: true, pct: true },
  { key: "volume", label: "成交張", num: true },
  { key: "foreign_consec_days", label: "外資連買日", num: true },
  { key: "trust_consec_days", label: "投信連買日", num: true },
  { key: "rev_yoy", label: "YOY%", num: true, pct: true },
  { key: "rev_mom", label: "MOM%", num: true, pct: true },
  { key: "rev_consec_grow", label: "連續成長月", num: true },
  { key: "bias_5", label: "乖離率%", num: true, pct: true },
  { key: "tdcc_big", label: "大戶%", num: true, pct: true },
  { key: "tdcc_delta", label: "週增減pp", num: true, pct: true },
];

const FIELDS: { key: string; label: string; placeholder: string; step?: string; span?: boolean }[] = [
  { key: "close", label: "股價區間", placeholder: "最低", span: true },
  { key: "chg", label: "漲跌幅 %", placeholder: "最低", step: "0.1", span: true },
  { key: "vol", label: "成交張數 ≥", placeholder: "如 1000" },
  { key: "foreign", label: "外資連買天數 ≥", placeholder: "如 3" },
  { key: "trust", label: "投信連買天數 ≥", placeholder: "如 2" },
  { key: "yoy", label: "營收 YOY % ≥", placeholder: "如 20" },
  { key: "mom", label: "營收 MOM % ≥", placeholder: "如 0" },
  { key: "grow", label: "營收連續成長月數 ≥", placeholder: "如 3" },
  { key: "bias", label: "5日乖離率 % 範圍", placeholder: "-3", step: "0.1", span: true },
  { key: "tdcc", label: "大戶持股（400張以上）% ≥", placeholder: "如 60", step: "0.1" },
  { key: "tdccDelta", label: "大戶持股週增減 pp ≥", placeholder: "如 0.5", step: "0.1" },
];

type FormState = Record<string, string>;

export default function FilterBuilder() {
  const [f, setF] = useState<FormState>({});
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState("volume");
  const [sortAsc, setSortAsc] = useState(false);
  const [limit, setLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("設定條件後按「篩選」");

  const num = (k: string) => {
    const v = f[k]?.trim();
    return v === "" || v == null ? null : parseFloat(v);
  };

  const ensureTdcc = async (): Promise<Record<string, { ratio: number; delta: number | null }> | null> => {
    if (!sb) return null;
    try {
      const { data } = await sb
        .from("daily_modules")
        .select("date,data")
        .eq("module_key", "tdcc")
        .order("date", { ascending: false })
        .limit(2);
      if (!data?.length) return null;
      const snaps: Record<string, Record<string, { big_ratio: number }>> = {};
      for (const r of data) snaps[r.date] = r.data as Record<string, { big_ratio: number }>;
      const dates = Object.keys(snaps).sort();
      const cur = snaps[dates[dates.length - 1]];
      const prev = dates.length > 1 ? snaps[dates[0]] : null;
      const map: Record<string, { ratio: number; delta: number | null }> = {};
      for (const [sid, a] of Object.entries(cur)) {
        map[sid] = {
          ratio: Math.round((a.big_ratio || 0) * 100) / 100,
          delta: prev?.[sid] ? Math.round(((a.big_ratio || 0) - (prev[sid].big_ratio || 0)) * 100) / 100 : null,
        };
      }
      return map;
    } catch {
      return null;
    }
  };

  const doFilter = async () => {
    if (!sb) return;
    setLoading(true);
    setMsg("");
    try {
      let q = sb.from("stock_metrics").select("*").order(sortCol, { ascending: sortAsc }).limit(limit);
      const rules: [string, string, string, number][] = [
        ["close_min", "close", "gte", 1],
        ["close_max", "close", "lte", 1],
        ["chg_min", "change_pct", "gte", 1],
        ["chg_max", "change_pct", "lte", 1],
        ["vol_min", "volume", "gte", 1],
        ["foreign_min", "foreign_consec_days", "gte", 1],
        ["trust_min", "trust_consec_days", "gte", 1],
        ["yoy_min", "rev_yoy", "gte", 1],
        ["mom_min", "rev_mom", "gte", 1],
        ["grow_min", "rev_consec_grow", "gte", 1],
        ["bias_min", "bias_5", "gte", 1],
        ["bias_max", "bias_5", "lte", 1],
      ];
      const apply = (col: string, op: "gte" | "lte", v: number) => {
        q = op === "gte" ? q.gte(col, v) : q.lte(col, v);
      };
      for (const [key, col, op] of rules) {
        const v = num(key);
        if (v !== null) apply(col, op as "gte" | "lte", v);
      }
      const { data, error } = await q;
      if (error) {
        setMsg(`查詢失敗: ${error.message}`);
        setRows([]);
        setCount(null);
        return;
      }
      let list = (data ?? []) as Record<string, unknown>[];
      const tdccMin = num("tdcc_min");
      const tdccDeltaMin = num("tdcc_delta_min");
      if ((tdccMin !== null || tdccDeltaMin !== null) && list.length) {
        const tdcc = await ensureTdcc();
        if (tdcc) {
          list = list
            .filter((r) => {
              const v = tdcc[String(r.stock_id)];
              if (!v) return false;
              if (tdccMin !== null && v.ratio < tdccMin) return false;
              if (tdccDeltaMin !== null && (v.delta == null || v.delta < tdccDeltaMin)) return false;
              return true;
            })
            .map((r) => ({ ...r, tdcc_big: tdcc[String(r.stock_id)].ratio, tdcc_delta: tdcc[String(r.stock_id)].delta }));
        }
      }
      setRows(list);
      setCount(list.length);
      setMsg("");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setF({});
    setRows([]);
    setCount(null);
    setMsg("設定條件後按「篩選」");
  };

  const changeSort = (key: string) => {
    if (sortCol === key) setSortAsc((v) => !v);
    else {
      setSortCol(key);
      setSortAsc(false);
    }
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = COLS.map((c) => c.label);
    const keys = COLS.map((c) => c.key);
    const lines = [headers.join(",")].concat(
      rows.map((r) =>
        keys
          .map((k) => {
            const v = r[k];
            if (v == null || v === "") return "";
            return typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v);
          })
          .join(","),
      ),
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "篩選結果.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  return (
    <>
      <div className="filter-panel">
        <div className="filter-grid">
          {FIELDS.map((field) => (
            <div className="filter-group" key={field.key}>
              <label>{field.label}</label>
              <div className="filter-row">
                <input
                  type="number"
                  placeholder={field.placeholder}
                  step={field.step}
                  value={f[field.key + "_min"] ?? ""}
                  onChange={(e) => set(field.key + "_min", e.target.value)}
                  aria-label={field.label}
                />
                {field.span && (
                  <>
                    <span>~</span>
                    <input
                      type="number"
                      placeholder="最高"
                      step={field.step}
                      value={f[field.key + "_max"] ?? ""}
                      onChange={(e) => set(field.key + "_max", e.target.value)}
                      aria-label={`${field.label}上限`}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="filter-actions">
          <button type="button" className="btn-filter" onClick={doFilter} disabled={loading}>
            {loading ? "查詢中..." : "篩選"}
          </button>
          <button type="button" className="btn-reset" onClick={reset}>
            清除條件
          </button>
          <button type="button" className="btn-reset" onClick={exportCSV}>
            匯出 CSV
          </button>
          <span className="result-count">
            {count !== null ? `${count} 檔符合` : msg}
            {count !== null && rows[0]?.date ? `（資料 ${rows[0].date}）` : ""}
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-msg">{loading ? "查詢中..." : count === 0 ? "無符合條件的標的" : "設定條件後按「篩選」"}</div>
      ) : (
        <>
          <div className="table-wrap" style={{ maxHeight: 620, overflowY: "auto" }}>
            <table>
              <thead style={{ position: "sticky", top: 0 }}>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} className={c.num ? "num" : ""} onClick={() => changeSort(c.key)} style={{ cursor: "pointer" }}>
                      {c.label}
                      <span className="sort-arrow">{sortCol === c.key ? (sortAsc ? " ↑" : " ↓") : ""}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.stock_id)}>
                    {COLS.map((c) => {
                      const v = r[c.key];
                      if (!c.num) return <td key={c.key}>{c.key === "stock_id" ? <Link href={`/stock/${v}`}>{String(v)}</Link> : String(v ?? "—")}</td>;
                      const n = Number(v);
                      const cls = c.pct ? pctClass(n) : "";
                      return (
                        <td key={c.key} className={`num ${cls}`}>
                          {v == null ? "—" : c.pct ? `${fmtSigned(n)}%` : fmt(n, n % 1 !== 0 ? 2 : 0)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length >= limit && (
            <div style={{ marginTop: 10, textAlign: "center" }}>
              <button type="button" className="btn" onClick={() => setLimit((l) => l + 200)}>
                載入更多
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
