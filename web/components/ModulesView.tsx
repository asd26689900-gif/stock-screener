"use client";

import { useState } from "react";
import { sb } from "@/lib/supabase";
import { MODULE_META, MODULE_ORDER } from "@/lib/modules";
import type { Row } from "@/lib/data";
import RowTable from "./RowTable";
import Skeleton from "./Skeleton";

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
  const [allOpen, setAllOpen] = useState(true);

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
        <button type="button" className="btn" onClick={() => setAllOpen((v) => !v)}>
          {allOpen ? "全部收合" : "全部展開"}
        </button>
      </div>
      {loading ? (
        <Skeleton rows={5} />
      ) : (
        MODULE_ORDER.map((key) => {
          const meta = MODULE_META[key];
          const rows = modules[key] ?? [];
          if (onlyFilled && rows.length === 0) return null;
          return (
            <div key={key} className={`module ${allOpen ? "open" : ""}`} style={{ marginBottom: 14 }}>
              <div className="module-header" onClick={(e) => (e.currentTarget.parentElement as HTMLElement).classList.toggle("open")}>
                <span className="arrow">▸</span>
                <span className="module-title">{meta.title}</span>
                <span className="badge-count">{rows.length} 檔</span>
              </div>
              <div className="module-desc">{meta.desc}</div>
              <div className="module-meta">
                {meta.rules.map((r) => (
                  <span key={r}>{r}</span>
                ))}
              </div>
              <div style={{ padding: "12px 14px" }}>
                <RowTable rows={rows} cols={meta.cols} star />
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
