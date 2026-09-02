"use client";

import { useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { MODULE_META, MODULE_ORDER } from "@/lib/modules";
import type { Row } from "@/lib/data";
import { fmt, fmtSigned, pctClass } from "@/lib/format";
import RowTable from "./RowTable";
import Skeleton from "./Skeleton";

function ModuleCard({ moduleKey, rows, expanded, onToggle }: { moduleKey: string; rows: Row[]; expanded: boolean; onToggle: () => void }) {
  const meta = MODULE_META[moduleKey];
  const top3 = rows.slice(0, 3);
  return (
    <div className="mod-card">
      <div className="mod-card-head" onClick={onToggle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="mod-card-title">{meta.title}</span>
            <span className="badge-count">{rows.length} 檔</span>
          </div>
          <div className="mod-card-desc">{meta.desc}</div>
        </div>
        <span className={`mod-card-arrow ${expanded ? "open" : ""}`}>▾</span>
      </div>
      {/* 預覽：前 3 檔 */}
      {!expanded && top3.length > 0 && (
        <div className="mod-card-preview">
          {top3.map((r) => (
            <Link key={r[0]} href={`/stock/${r[0]}`} className="mod-preview-row">
              <span className="mod-preview-id">{r[0]}</span>
              <span className="mod-preview-name">{r[1]}</span>
              <span className={`mod-preview-pct ${pctClass(Number(r[3]))}`}>{fmtSigned(Number(r[3]))}%</span>
              <span className="mod-preview-price">{fmt(Number(r[2]), 2)}</span>
            </Link>
          ))}
          {rows.length > 3 && (
            <button type="button" className="mod-more-btn" onClick={onToggle}>
              展開全部 {rows.length} 檔 →
            </button>
          )}
        </div>
      )}
      {!expanded && rows.length === 0 && (
        <div className="mod-card-empty">今日無符合標的</div>
      )}
      {/* 展開：篩選條件 + 完整表格 */}
      {expanded && (
        <>
          <div className="mod-card-rules">
            {meta.rules.map((r) => (
              <span key={r} className="strat-rule">{r}</span>
            ))}
          </div>
          <div style={{ padding: "0 2px 4px" }}>
            <RowTable rows={rows} cols={meta.cols} star />
          </div>
        </>
      )}
    </div>
  );
}

export default function ModulesView({
  dates,
  initialDate,
  initialModules,
}: {
  dates: string[];
  initialDate: string;
  initialModules: Record<string, Row[]>;
}) {
  const [date, setDate] = useState(initialDate);
  const [modules, setModules] = useState<Record<string, Row[]>>(initialModules);
  const [loading, setLoading] = useState(false);
  const [onlyFilled, setOnlyFilled] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const toggleAll = () => {
    const anyOpen = Object.values(expanded).some(Boolean);
    const next: Record<string, boolean> = {};
    for (const k of MODULE_ORDER) next[k] = !anyOpen;
    setExpanded(next);
  };

  const switchDate = async (d: string) => {
    setDate(d);
    setLoading(true);
    try {
      if (!sb) return;
      const { data } = await sb.from("daily_modules").select("module_key,data").eq("date", d);
      const m: Record<string, Row[]> = {};
      for (const r of data ?? []) m[r.module_key] = r.data as Row[];
      setModules(m);
    } finally {
      setLoading(false);
    }
  };

  const totalStocks = MODULE_ORDER.reduce((s, k) => s + (modules[k]?.length ?? 0), 0);

  return (
    <>
      <div className="controls" style={{ marginBottom: 14 }}>
        <span className="date-label">資料日期 {date}</span>
        <select value={date} onChange={(e) => switchDate(e.target.value)} aria-label="選擇選股資料日期">
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={onlyFilled} onChange={(e) => setOnlyFilled(e.target.checked)} /> 僅顯示有標的
        </label>
        <button type="button" className="btn" onClick={toggleAll}>
          {Object.values(expanded).some(Boolean) ? "全部收合" : "全部展開"}
        </button>
        <span className="hint" style={{ marginLeft: "auto" }}>共 {totalStocks} 檔入選</span>
      </div>
      {loading ? (
        <Skeleton rows={5} />
      ) : (
        <div className="mod-card-grid">
          {MODULE_ORDER.map((key) => {
            const rows = modules[key] ?? [];
            if (onlyFilled && rows.length === 0) return null;
            return <ModuleCard key={key} moduleKey={key} rows={rows} expanded={!!expanded[key]} onToggle={() => toggleExpand(key)} />;
          })}
        </div>
      )}
    </>
  );
}
