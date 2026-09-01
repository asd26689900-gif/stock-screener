"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { fmtSigned, pctClass } from "@/lib/format";

export type GraphConcept = {
  key: string;
  title: string;
  tier: number; // 0=上游 1=中游 2=下游
  up: string[];
  down: string[];
  avgChg: number | null;
};

const TIER_X: Record<number, number> = { 0: 95, 1: 345, 2: 595 };
const TIER_LABEL: Record<number, string> = { 0: "上游", 1: "中游", 2: "下游" };

export default function ThemeTierGraph({
  concepts,
  focusKey,
}: {
  concepts: GraphConcept[];
  focusKey?: string;
}) {
  const router = useRouter();

  const { edges, nodes } = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const tiers: Record<number, GraphConcept[]> = { 0: [], 1: [], 2: [] };
    concepts.forEach((c) => tiers[c.tier ?? 1].push(c));
    const H = Math.max(300, ...Object.values(tiers).map((a) => Math.max(a.length, 1) * 84));
    Object.entries(tiers).forEach(([t, arr]) => {
      const start = (H - arr.length * 84) / 2 + 42;
      arr.forEach((c, i) => {
        pos[c.key] = { x: TIER_X[Number(t)], y: start + i * 84 };
      });
    });
    const edgeSet = new Set<string>();
    const edgeArr: [string, string][] = [];
    concepts.forEach((c) => {
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
  }, [concepts]);

  const related = useMemo(() => {
    if (!focusKey) return null;
    const cur = concepts.find((c) => c.key === focusKey);
    if (!cur) return null;
    const set = new Set<string>([focusKey, ...(cur.up || []), ...(cur.down || [])]);
    return { cur, set, up: cur.up ?? [], down: cur.down ?? [] };
  }, [concepts, focusKey]);

  const H = Math.max(300, ...Object.values(nodes).map((n) => n.y + 44));

  return (
    <div className="graph-box">
      <div className="graph-legend">
        <span className="legend-item"><i style={{ background: "rgba(192,84,79,.28)" }} />上漲</span>
        <span className="legend-item"><i style={{ background: "rgba(74,139,110,.28)" }} />下跌</span>
        <span className="legend-item">→ 供應方向（上游→下游）</span>
        {related && <span className="legend-item">目前題材：<b style={{ color: "var(--gold)" }}>{related.cur.title}</b>（鄰居高亮，其餘淡化）</span>}
      </div>
      <svg viewBox={`0 0 690 ${H}`} className="graph-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
            <path d="M0 0L10 5L0 10z" fill="#9AA0A6" />
          </marker>
        </defs>
        {[0, 1, 2].map((t) => (
          <text key={t} x={TIER_X[t]} y={16} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-secondary)" letterSpacing="2">
            {TIER_LABEL[t]}
          </text>
        ))}
        {edges.map(([a, b]) => {
          const p = nodes[a], q = nodes[b];
          if (!p || !q) return null;
          const active = related ? related.set.has(a) && related.set.has(b) : true;
          return (
            <line
              key={a + b}
              x1={p.x + 62}
              y1={p.y}
              x2={q.x - 62}
              y2={q.y}
              stroke="#9AA0A6"
              strokeWidth={active ? 1.8 : 1}
              markerEnd="url(#arrow)"
              opacity={active ? 0.85 : 0.12}
            />
          );
        })}
        {Object.entries(nodes).map(([k, { x, y }]) => {
          const c = concepts.find((cc) => cc.key === k);
          if (!c) return null;
          const dim = related && !related.set.has(k);
          const isFocus = related?.cur.key === k;
          const isUp = related && related.up.includes(k);
          const isDown = related && related.down.includes(k);
          const fill = c.avgChg == null ? "var(--surface)" : c.avgChg > 0 ? "rgba(192,84,79,0.10)" : "rgba(74,139,110,0.10)";
          const stroke = isFocus ? "var(--gold)" : isUp ? "var(--green)" : isDown ? "var(--teal)" : "var(--border)";
          return (
            <g
              key={k}
              style={{ cursor: "pointer", opacity: dim ? 0.14 : 1 }}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/concepts/${k}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/concepts/${k}`);
              }}
            >
              <rect x={x - 62} y={y - 24} width={124} height={48} rx={11} fill={fill} stroke={stroke} strokeWidth={isFocus ? 2 : 1.2} />
              <text x={x} y={y - 4} textAnchor="middle" fontSize="12" fontWeight={isFocus ? 800 : 600} fill="var(--ink)">
                {c.title}
              </text>
              <text x={x} y={y + 13} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)" fontFamily="monospace" className={c.avgChg == null ? "" : pctClass(c.avgChg)}>
                {c.avgChg == null ? "—" : `${fmtSigned(c.avgChg)}%`}
              </text>
            </g>
          );
        })}
      </svg>
      {related && (related.up.length > 0 || related.down.length > 0) && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "4px 6px 2px", fontSize: 12 }}>
          {related.up.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span className="chip teal">上游（供給）</span>
              {related.up.map((k) => {
                const c = concepts.find((cc) => cc.key === k);
                return c ? <a key={k} href={`/concepts/${k}`} className="chip">{c.title}</a> : null;
              })}
            </div>
          )}
          {related.down.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span className="chip gold">下游（需求）</span>
              {related.down.map((k) => {
                const c = concepts.find((cc) => cc.key === k);
                return c ? <a key={k} href={`/concepts/${k}`} className="chip">{c.title}</a> : null;
              })}
            </div>
          )}
        </div>
      )}
      <p className="graph-note">顏色為題材平均漲跌（紅漲綠跌）；節點大小固定、位置依「上游→中游→下游」分層。點節點看該題材。</p>
    </div>
  );
}
