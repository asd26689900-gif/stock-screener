"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HeatIndustry } from "@/lib/data";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

type TmItem = {
  label: string;
  value: number;
  chg: number;
  mcap?: number;
  amount?: number;
  id?: string;
  name?: string;
};

function chgColor(pct: number): string {
  const c = Math.max(-10, Math.min(10, pct));
  const abs = Math.abs(c) / 10;
  const s = Math.pow(abs, 0.55);
  let r: number, g: number, b: number;
  if (c >= 0) {
    r = Math.round(136 + 56 * s);
    g = Math.round(136 - 52 * s);
    b = Math.round(136 - 57 * s);
  } else {
    r = Math.round(136 - 91 * s);
    g = Math.round(136 + 7 * s);
    b = Math.round(136 - 58 * s);
  }
  return `rgb(${r},${g},${b})`;
}

function worstR(row: TmItem[], rv: number, side: number, total: number, fs: number): number {
  const ss = fs * (rv / total);
  if (ss <= 0) return Infinity;
  let w = 0;
  for (const it of row) {
    const cs = side * (it.value / rv);
    const r = Math.max(ss / cs, cs / ss);
    if (r > w) w = r;
  }
  return w;
}

function squarify(items: TmItem[], x: number, y: number, w: number, h: number): (TmItem & { x: number; y: number; w: number; h: number })[] {
  if (!items.length) return [];
  const rects: (TmItem & { x: number; y: number; w: number; h: number })[] = [];
  let remaining = [...items], cx = x, cy = y, cw = w, ch = h;
  while (remaining.length) {
    const isW = cw >= ch;
    const side = isW ? ch : cw;
    const totR = remaining.reduce((s, i) => s + i.value, 0);
    let row = [remaining[0]];
    let rv = remaining[0].value;
    for (let i = 1; i < remaining.length; i++) {
      const wC = worstR(row, rv, side, totR, isW ? cw : ch);
      row.push(remaining[i]);
      const wN = worstR(row, rv + remaining[i].value, side, totR, isW ? cw : ch);
      if (wN > wC && row.length > 1) {
        row.pop();
        break;
      }
      rv += remaining[i].value;
    }
    const ss = isW ? cw * (rv / totR) : ch * (rv / totR);
    let off = 0;
    for (const it of row) {
      const fr = it.value / rv;
      const cs = side * fr;
      if (isW) rects.push({ ...it, x: cx, y: cy + off, w: ss, h: cs });
      else rects.push({ ...it, x: cx + off, y: cy, w: cs, h: ss });
      off += cs;
    }
    remaining = remaining.slice(row.length);
    if (isW) {
      cx += ss;
      cw -= ss;
    } else {
      cy += ss;
      ch -= ss;
    }
  }
  return rects;
}

export default function HeatmapView({ industries, date }: { industries: HeatIndustry[]; date: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 450 });
  const [view, setView] = useState<{ type: "industry" } | { type: "stocks"; ind: HeatIndustry }>({ type: "industry" });
  const [tip, setTip] = useState<{ x: number; y: number; item: TmItem } | null>(null);

  useEffect(() => {
    const measure = () => {
      const rect = boxRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0) setSize({ w: rect.width, h: rect.width * (9 / 16) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view]);

  const items: TmItem[] =
    view.type === "industry"
      ? industries.map((ind) => ({
          label: ind.name,
          value: ind.total_amount,
          chg: ind.avg_chg,
          mcap: ind.total_amount,
          amount: ind.total_amount,
          onClick: () => setView({ type: "stocks", ind }),
        }))
      : (view.ind.stocks ?? []).map((s) => ({
          label: `${s.id} ${s.name}`,
          value: s.mcap || s.amount,
          chg: s.chg_pct,
          mcap: s.mcap,
          amount: s.amount,
          id: s.id,
          name: s.name,
        }));

  const rects = squarify([...items].sort((a, b) => b.value - a.value), 0, 0, size.w, size.h);
  const fmtAmt = (v?: number) => {
    if (!v) return "—";
    if (v >= 1e8) return `${(v / 1e8).toFixed(0)}億`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(0)}百萬`;
    return Math.round(v).toLocaleString();
  };

  return (
    <>
      <div className="controls" style={{ marginBottom: 12, justifyContent: "space-between" }}>
        {view.type === "industry" ? (
          <span className="date-label">資料日期 {date}</span>
        ) : (
          <div className="breadcrumb" style={{ display: "flex", marginBottom: 0 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setView({ type: "industry" });
              }}
            >
              全部產業
            </a>
            <span>›</span>
            <span>{view.ind.name}</span>
          </div>
        )}
        <span className="hint">色塊面積 = 市值，顏色 = 漲跌幅。點擊產業可展開成分股。</span>
      </div>
      <div className="treemap-wrap">
        <div className="treemap" ref={boxRef} style={{ height: size.h }}>
          {rects.map((r, i) => (
            <div
              key={i}
              className={`tm-cell ${r.w < 60 || r.h < 40 ? "small" : ""} ${r.w < 35 || r.h < 25 ? "tiny" : ""}`}
              style={{ left: r.x, top: r.y, width: r.w, height: r.h, background: chgColor(r.chg) }}
              role="button"
              tabIndex={0}
              aria-label={`${r.label} 漲跌 ${fmtSigned(r.chg, 2)}%`}
              onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, item: r })}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, item: r })}
              onMouseLeave={() => setTip(null)}
              onClick={() => (r.id ? undefined : setView({ type: "stocks", ind: view.type === "industry" ? industries.find((x) => x.name === r.label)! : view.ind }))}
            >
              <span className="tm-label">{r.label}</span>
              <span className="tm-val">{fmtSigned(r.chg, 1)}%</span>
            </div>
          ))}
        </div>
        <div className="legend">
          <span className="legend-label">-10%</span>
          <div className="legend-bar" />
          <span className="legend-label">+10%</span>
        </div>
      </div>
      {view.type === "stocks" && (
        <div className="stk-table-wrap show">
          <div className="stk-table-title">{view.ind.name} — 成分股明細</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>股號</th>
                  <th>名稱</th>
                  <th className="num">收盤價</th>
                  <th className="num">漲跌%</th>
                  <th className="num">市值</th>
                  <th className="num">成交額</th>
                </tr>
              </thead>
              <tbody>
                {(view.ind.stocks ?? [])
                  .slice()
                  .sort((a, b) => (b.mcap || b.amount) - (a.mcap || a.amount))
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/stock/${s.id}`}>{s.id}</Link>
                      </td>
                      <td>{s.name}</td>
                      <td className="num">{fmt(s.close, 2)}</td>
                      <td className={`num ${pctClass(s.chg_pct)}`}>{fmtSigned(s.chg_pct)}%</td>
                      <td className="num">{fmtAmt(s.mcap)}</td>
                      <td className="num">{fmtAmt(s.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tip && (
        <div className="tooltip show" style={{ left: tip.x + 12, top: tip.y - 40 }}>
          <div className="tt-name">{tip.item.label}</div>
          <div className="tt-row">
            <span>漲跌幅</span>
            <span className={pctClass(tip.item.chg)}>{fmtSigned(tip.item.chg, 2)}%</span>
          </div>
          <div className="tt-row">
            <span>市值</span>
            <span>{fmtAmt(tip.item.mcap)}</span>
          </div>
          <div className="tt-row">
            <span>成交額</span>
            <span>{fmtAmt(tip.item.amount)}</span>
          </div>
        </div>
      )}
    </>
  );
}
