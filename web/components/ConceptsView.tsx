"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Concept } from "@/lib/concepts";
import type { ConceptStock } from "@/lib/stock";
import { fmtSigned, pctClass } from "@/lib/format";
import ThemeTierGraph from "./ThemeTierGraph";

type Card = Concept & {
  avgChg: number;
  count: number;
  upCount: number;
  dnCount: number;
  leaderName: string;
  leaderChg: number;
  ret: { d1: number | null; d5: number | null; d20: number | null; d60: number | null };
};

export default function ConceptsView({
  concepts,
  stocksMap,
  date,
  indexRet,
}: {
  concepts: Concept[];
  stocksMap: Map<string, ConceptStock>;
  date: string;
  indexRet: { d1: number | null; d5: number | null; d20: number | null; d60: number | null };
}) {
  const [q, setQ] = useState("");
  const avgRet = (list: ConceptStock[], key: "d1" | "d5" | "d20" | "d60"): number | null => {
    const vals = list.map((s) => s.returns[key]).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };
  const cards: Card[] = useMemo(() => {
    return concepts
      .map((c) => {
        const stocks = c.ids.map((id) => stocksMap.get(id)).filter(Boolean) as ConceptStock[];
        if (!stocks.length) return null;
        const avgChg = stocks.reduce((s, d) => s + (d.change_pct || 0), 0) / stocks.length;
        const leader = stocks.reduce((best, d) => ((d.change_pct || 0) > (best.change_pct || 0) ? d : best), stocks[0]);
        return {
          ...c,
          avgChg,
          count: stocks.length,
          upCount: stocks.filter((d) => (d.change_pct || 0) > 0).length,
          dnCount: stocks.filter((d) => (d.change_pct || 0) < 0).length,
          leaderName: leader.name || leader.stock_id,
          leaderChg: leader.change_pct || 0,
          ret: { d1: avgRet(stocks, "d1"), d5: avgRet(stocks, "d5"), d20: avgRet(stocks, "d20"), d60: avgRet(stocks, "d60") },
        };
      })
      .filter(Boolean) as Card[];
  }, [concepts, stocksMap]);

  const visible = q ? cards.filter((c) => c.title.includes(q) || c.desc.includes(q)) : cards;
  const best = cards[0], worst = cards[cards.length - 1];
  const upTotal = cards.filter((c) => c.avgChg > 0).length;
  const dnTotal = cards.filter((c) => c.avgChg < 0).length;

  return (
    <>
      <div className="summary-cards" style={{ marginBottom: 12 }}>
        <div className="summary-card">
          <div className="summary-label">題材總數</div>
          <div className="summary-val">{cards.length}</div>
          <div className="summary-sub">資料日期 {date}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">上漲題材</div>
          <div className="summary-val up">{upTotal}</div>
          <div className="summary-sub">下跌 {dnTotal} 組</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">最強題材</div>
          <div className="summary-val" style={{ fontSize: 15 }}>
            {best?.title ?? "—"}
          </div>
          <div className={`summary-sub ${best ? pctClass(best.avgChg) : ""}`}>{best ? `${fmtSigned(best.avgChg)}%` : "—"}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">最弱題材</div>
          <div className="summary-val" style={{ fontSize: 15 }}>
            {worst?.title ?? "—"}
          </div>
          <div className={`summary-sub ${worst ? pctClass(worst.avgChg) : ""}`}>{worst ? `${fmtSigned(worst.avgChg)}%` : "—"}</div>
        </div>
      </div>

      <div className="section-title">題材關係圖</div>
      <ThemeTierGraph
        concepts={cards.map((c) => ({ key: c.key, title: c.title, tier: c.tier, up: c.up, down: c.down, avgChg: c.avgChg }))}
      />
      <p className="hint" style={{ marginTop: -8, marginBottom: 14 }}>
        大盤同期：1日 {indexRet.d1 != null ? `${fmtSigned(indexRet.d1)}%` : "—"} ・ 5日 {indexRet.d5 != null ? `${fmtSigned(indexRet.d5)}%` : "—"} ・ 20日 {indexRet.d20 != null ? `${fmtSigned(indexRet.d20)}%` : "—"} ・ 60日 {indexRet.d60 != null ? `${fmtSigned(indexRet.d60)}%` : "—"}
      </p>

      <div className="section-title">
        題材列表
        <input
          type="search"
          placeholder="搜尋題材..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginLeft: "auto", maxWidth: 220, padding: "6px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5 }}
          aria-label="搜尋題材"
        />
      </div>
      <div className="concept-grid">
        {visible.map((c) => {
          const cls = pctClass(c.avgChg);
          const arrow = c.avgChg > 0 ? "▲" : c.avgChg < 0 ? "▼" : "";
          const borderColor = c.avgChg > 0 ? "var(--red)" : c.avgChg < 0 ? "var(--green)" : "var(--border)";
          return (
            <Link key={c.key} href={`/concepts/${c.key}`} className="concept-card">
              <div className="border-left" style={{ background: borderColor }} />
              <div className="card-top">
                <div className="card-title">{c.title}</div>
                <div className={`card-chg ${cls}`}>
                  {arrow} {fmtSigned(c.avgChg)}%
                </div>
              </div>
              <div className="card-desc">{c.desc}</div>
              <div className="stock-returns">
                {(["d1", "d5", "d20", "d60"] as const).map((k) => (
                  <span key={k} className={c.ret[k] == null ? "" : pctClass(c.ret[k])}>
                    {k.slice(1)}日 {c.ret[k] == null ? "—" : `${fmtSigned(c.ret[k])}%`}
                  </span>
                ))}
              </div>
              <div className="card-bottom">
                <span className="card-count">{c.count} 檔</span>
                <span className="card-updn">
                  <b className="up">漲 {c.upCount}</b> / <b className="down">跌 {c.dnCount}</b>
                </span>
                <span className="card-leader">
                  領漲 {c.leaderName} <span className={pctClass(c.leaderChg)}>{fmtSigned(c.leaderChg)}%</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
