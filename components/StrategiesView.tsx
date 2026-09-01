"use client";

import { useState } from "react";
import { STRATEGIES, STRATEGY_ORDER } from "@/lib/strategies";
import type { Row } from "@/lib/data";
import RowTable from "./RowTable";

export default function StrategiesView({ strategies, date }: { strategies: Record<string, Row[]>; date: string }) {
  const [active, setActive] = useState(STRATEGY_ORDER[0]);
  const meta = STRATEGIES[active];
  const rows = strategies[active] ?? [];
  return (
    <>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {STRATEGY_ORDER.map((k) => (
          <button key={k} type="button" className={`tab ${active === k ? "active" : ""}`} onClick={() => setActive(k)}>
            {STRATEGIES[k].title} <span className="badge-count">{(strategies[k] ?? []).length}</span>
          </button>
        ))}
      </div>
      <div className="strat" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 12 }}>
        <div className="strat-title">{meta.title}</div>
        <div className="strat-desc">{meta.desc}</div>
        <div className="strat-rules">
          {meta.rules.map((r) => (
            <span key={r} className="strat-rule">
              {r}
            </span>
          ))}
        </div>
        <div className="strat-meta" style={{ marginTop: 10 }}>
          資料日期 {date}
        </div>
        <div style={{ marginTop: 12 }}>
          <RowTable rows={rows} cols={meta.cols} star />
        </div>
      </div>
    </>
  );
}
