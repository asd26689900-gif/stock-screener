"use client";

import { useEffect, useState } from "react";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

type Quote = { sym: string; name: string; price?: number; chg?: number; chgPct?: number; date?: string; spark?: number[] };
type GlobalData = {
  tw?: { indices: Quote[] };
  us: { indices: Quote[]; stocks: Quote[] };
  jp: { indices: Quote[]; stocks: Quote[] };
  extra: Quote[];
  updated_at: string;
};

function Spark({ closes }: { closes?: number[] }) {
  if (!closes || closes.length < 2) return null;
  const W = 92, H = 26, pad = 2;
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const y = (v: number) => pad + (1 - (v - lo) / ((hi - lo) || 1)) * (H - pad * 2);
  const x = (i: number) => pad + (i * (W - pad * 2)) / (closes.length - 1);
  const d = closes.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ");
  const up = closes[closes.length - 1] >= closes[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 92, height: 26 }}>
      <path d={d} fill="none" stroke={up ? "var(--red)" : "var(--green)"} strokeWidth="1.2" />
    </svg>
  );
}

function Section({ title, items }: { title: string; items: Quote[] }) {
  return (
    <>
      <div className="section-title">{title}</div>
      <div className="summary-cards">
        {items.map((s) => (
          <div className="summary-card" key={s.sym}>
            <div className="summary-label">{s.name}</div>
            <div className={`summary-val ${s.chgPct != null ? pctClass(s.chgPct) : ""}`}>{s.price != null ? fmt(s.price, 2) : "—"}</div>
            <div className={`summary-sub ${s.chgPct != null ? pctClass(s.chgPct) : ""}`}>
              {s.chg != null ? `${fmtSigned(s.chg, 2)}` : "—"} ・ {s.chgPct != null ? `${fmtSigned(s.chgPct)}%` : "—"} ・ {s.date ?? ""}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Heat({ items }: { items: Quote[] }) {
  return (
    <div className="g-heat">
      {items.map((s) => {
        if (s.price == null) return null;
        const cls = s.chgPct! > 0 ? "up" : s.chgPct! < 0 ? "dn" : "";
        return (
          <a key={s.sym} className={`g-tile ${cls}`} href={`https://tw.stock.yahoo.com/quote/${encodeURIComponent(s.sym)}`} target="_blank" rel="noopener noreferrer">
            <div>
              <span className="g-sym">{s.sym}</span> <span className="g-name">{s.name}</span>
            </div>
            <div className="g-price">{fmt(s.price, 2)}</div>
            <div className={`g-chg ${cls}`}>
              {fmtSigned(s.chg!, 2)} ・ {fmtSigned(s.chgPct!)}%
            </div>
            <Spark closes={s.spark} />
          </a>
        );
      })}
    </div>
  );
}

export default function GlobalView() {
  const [data, setData] = useState<GlobalData | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/global", { cache: "no-store" });
        setData(await r.json());
      } catch {
        setData(null);
      }
    })();
  }, []);
  if (!data) {
    return (
      <div className="sk-box">
        <i /><i /><i /><i />
      </div>
    );
  }
  return (
    <>
      <p className="hint" style={{ marginBottom: 10 }}>
        資料來源：Yahoo Finance（延遲約 15 分）。美股為前一日收盤、日股為當日行情。
      </p>
      {data.tw?.indices?.length ? <Section title="台股指數" items={data.tw.indices} /> : null}
      <Section title="美股指數" items={data.us.indices} />
      <Section title="美股熱門" items={[]} />
      <Heat items={data.us.stocks} />
      <Section title="日股" items={data.jp.indices} />
      <Heat items={data.jp.stocks} />
      <Section title="匯率・原物料・加密貨幣" items={[]} />
      <Heat items={data.extra} />
    </>
  );
}
