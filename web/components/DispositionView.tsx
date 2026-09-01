"use client";

import { useState } from "react";
import Link from "next/link";
import { fmt } from "@/lib/format";

type DspRow = {
  id: string;
  name: string;
  market?: string;
  level: string;
  reason?: string;
  trading_info?: string;
  period?: string;
  threshold?: number;
  threshold_note?: string;
  first_alert?: string;
  close?: number;
  measure?: string;
};

const LV: Record<string, [string, string]> = {
  disposing: ["disposing", "處置中"],
  alert: ["alert", "已達標"],
  high: ["high", "高風險"],
  near: ["near", "接近"],
  watch: ["watch", "觀察"],
};

const LAMPS: [string, string, string][] = [
  ["disposing", "處置中", "lv-danger"],
  ["alert", "已達標", "lv-alert"],
  ["high", "高風險", "lv-alert"],
  ["near", "接近", "lv-watch"],
  ["watch", "觀察", "lv-ok"],
];

export default function DispositionView({ date, list, counts }: { date: string; list: DspRow[]; counts: Record<string, number> }) {
  const [filter, setFilter] = useState("all");
  const rows = list.filter((r) => filter === "all" || r.level === filter);
  return (
    <>
      <div className="date-label" style={{ marginBottom: 10 }}>
        資料日 {date}（每日 19:00 自動更新，處置公告發布後）
      </div>
      <div className="dsp-lamps" style={{ marginBottom: 14 }}>
        {LAMPS.map(([k, label, lv]) => (
          <button key={k} type="button" className={`dsp-lamp ${lv} ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
            <div className="dl-count">{counts[k] ?? 0}</div>
            <div className="dl-label">{label}</div>
          </button>
        ))}
        <button type="button" className={`dsp-lamp ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          <div className="dl-count">顯示全部 {list.length} 檔</div>
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="empty-msg">此級別目前無標的</div>
      ) : (
        <div className="dsp-list">
          {rows.map((r) => {
            const [cls, label] = LV[r.level] ?? LV.watch;
            const reason = String(r.reason || r.trading_info || "").replace(/<[^>]+>/g, "").trim() || "—";
            const period = r.period ? String(r.period).replace(/～|~/g, " ~ ") : "";
            return (
              <Link key={r.id} href={`/stock/${r.id}`} className="dsp-row">
                <span className={`dsp-tag ${cls}`}>{label}</span>
                <div className="dsp-body">
                  <div className="dsp-name">
                    <span className="dsp-id">{r.id}</span>
                    {r.name || ""}
                    {r.market ? <span className="chip" style={{ marginLeft: 6 }}>{r.market}</span> : null}
                  </div>
                  <div className="dsp-reason">
                    {reason}
                    {period ? ` ・ ${period}` : ""}
                  </div>
                  {r.first_alert && (
                    <div className="dsp-first" style={{ marginTop: 4 }}>
                      我方 {String(r.first_alert).slice(5).replace("-", "/")} 起示警
                    </div>
                  )}
                </div>
                <div className="dsp-right">
                  <div className="dsp-price">{r.close != null ? fmt(r.close, 2) : "—"}</div>
                  <div className="dsp-th">{r.measure ?? ""}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
