"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Concept } from "@/lib/concepts";
import type { ConceptStock } from "@/lib/stock";
import { fmtSigned, pctClass } from "@/lib/format";

type Card = Concept & { avgChg: number; count: number; upCount: number; dnCount: number; leaderName: string; leaderChg: number };

const TIER_X: Record<number, number> = { 0: 95, 1: 345, 2: 595 };
const TIER_LABEL: Record<number, string> = { 0: "上游", 1: "中游", 2: "下游" };

export default function ConceptsView({
  concepts,
  stocksMap,
  date,
}: {
  concepts: Concept[];
  stocksMap: Map<string, ConceptStock>;
  date: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
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
        };
      })
      .filter(Boolean) as Card[];
  }, [concepts, stocksMap]);

  const visible = q ? cards.filter((c) => c.title.includes(q) || c.desc.includes(q)) : cards;
  const best = cards[0], worst = cards[cards.length - 1];
  const upTotal = cards.filter((c) => c.avgChg > 0).length;
  const dnTotal = cards.filter((c) => c.avgChg < 0).length;

  const { edges, nodes } = useMemo(() => {
    const byKey = new Map(cards.map((c) => [c.key, c]));
    const related = cards.filter((c) => (c.up?.length || 0) || (c.down?.length || 0));
    const tiers: Record<number, Card[]> = { 0: [], 1: [], 2: [] };
    related.forEach((c) => tiers[c.tier ?? 1].push(c));
    const H = Math.max(380, ...Object.values(tiers).map((a) => Math.max(a.length, 1) * 92));
    const pos: Record<string, { x: number; y: number }> = {};
    Object.entries(tiers).forEach(([t, arr]) => {
      const start = (H - arr.length * 92) / 2 + 46;
      arr.forEach((c, i) => {
        pos[c.key] = { x: TIER_X[Number(t)], y: start + i * 92 };
      });
    });
    const edgeSet = new Set<string>();
    const edgeArr: [string, string][] = [];
    related.forEach((c) => {
      [...(c.up || []), ...(c.down || [])].forEach((o) => {
        if (!pos[c.key] || !pos[o]) return;
        const a = c.up?.includes(o) ? o : c.key;
        const b = c.up?.includes(o) ? c.key : o;
        const k = a + ">" + b;
        if (edgeSet.has(k)) return;
        edgeSet.add(k);
        edgeArr.push([a, b]);
      });
    });
    return { edges: edgeArr, nodes: pos };
  }, [cards]);

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
      <div className="graph-box">
        <div className="graph-legend">
          <span className="legend-item"><i style={{ background: "rgba(192,84,79,.28)" }} />上漲</span>
          <span className="legend-item"><i style={{ background: "rgba(74,139,110,.28)" }} />下跌</span>
          <span className="legend-item">→ 供應方向（上游→下游）</span>
          <span className="legend-item">點節點看單題材頁</span>
        </div>
        <svg viewBox={`0 0 690 ${Math.max(380, ...Object.values(nodes).map((n) => n.y + 40))}`} className="graph-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
              <path d="M0 0L10 5L0 10z" fill="#9AA0A6" />
            </marker>
          </defs>
          {edges.map(([a, b]) => {
            const p = nodes[a], q = nodes[b];
            if (!p || !q) return null;
            return <line key={a + b} x1={p.x + 62} y1={p.y} x2={q.x - 62} y2={q.y} stroke="#9AA0A6" strokeWidth="1.4" markerEnd="url(#arrow)" opacity="0.55" />;
          })}
          {Object.entries(nodes).map(([k, { x, y }]) => {
            const c = cards.find((cc) => cc.key === k);
            if (!c) return null;
            const fill = c.avgChg > 0 ? "rgba(192,84,79,0.10)" : c.avgChg < 0 ? "rgba(74,139,110,0.10)" : "var(--surface)";
            return (
              <g key={k} style={{ cursor: "pointer" }} role="button" tabIndex={0} onClick={() => router.push(`/concepts/${k}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/concepts/${k}`); }}>
                <rect x={x - 62} y={y - 26} width={124} height={52} rx={11} fill={fill} stroke="var(--border)" />
                <text x={x} y={y - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">{c.title}</text>
                <text x={x} y={y + 13} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)" fontFamily="monospace">
                  {fmtSigned(c.avgChg)}%
                </text>
              </g>
            );
          })}
        </svg>
        <p className="graph-note">顏色為當日題材平均漲跌（紅漲綠跌）；拓撲為編輯維護、漲跌即時更新。點節點看成分股。</p>
      </div>

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
