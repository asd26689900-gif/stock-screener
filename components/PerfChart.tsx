"use client";

import { useEffect, useRef, useState } from "react";
import { ColorType, createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";

// 績效表現：個股 vs 加權指數，期間報酬（%，由區間首日歸零）
const RANGES: [string, string][] = [
  ["1週", "5d"], ["1月", "1mo"], ["3月", "3mo"], ["半年", "6mo"], ["1年", "1y"], ["3年", "3y"],
];

function cssVar(n: string, fb: string): string {
  try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb; } catch { return fb; }
}

async function fetchPct(sid: string, range: string): Promise<{ time: string; value: number }[]> {
  try {
    const r = await fetch(`/api/chart?sid=${encodeURIComponent(sid)}&interval=1d&range=${range}`);
    if (!r.ok) return [];
    const j = await r.json();
    const bars = (j.bars || []) as { d: string; c: number }[];
    if (!bars.length || !bars[0].c) return [];
    const base = bars[0].c;
    return bars.map((b) => ({ time: b.d, value: Math.round((b.c / base - 1) * 10000) / 100 }));
  } catch {
    return [];
  }
}

export default function PerfChart({ sid, name }: { sid: string; name: string }) {
  const [range, setRange] = useState("6mo");
  const [ret, setRet] = useState<{ stock: number | null; twii: number | null }>({ stock: null, twii: null });
  const wrap = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const stockS = useRef<ISeriesApi<"Line"> | null>(null);
  const twiiS = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      height: 260,
      layout: { background: { type: ColorType.Solid, color: cssVar("--card", "#ffffff") }, textColor: cssVar("--text-secondary", "#666666"), fontSize: 11 },
      grid: { vertLines: { color: cssVar("--border-light", "#eeeeee") }, horzLines: { color: cssVar("--border-light", "#eeeeee") } },
      rightPriceScale: { borderColor: cssVar("--border", "#dddddd") },
      timeScale: { borderColor: cssVar("--border", "#dddddd") },
      localization: { locale: "zh-TW", priceFormatter: (p: number) => (p >= 0 ? "+" : "") + p.toFixed(1) + "%" },
      crosshair: { vertLine: { labelBackgroundColor: "#8A6508" }, horzLine: { labelBackgroundColor: "#8A6508" } },
    });
    stockS.current = c.addLineSeries({ color: cssVar("--gold", "#8A6508"), lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    twiiS.current = c.addLineSeries({ color: cssVar("--teal", "#2F6E6C"), lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    chart.current = c;
    const mo = new MutationObserver(() =>
      c.applyOptions({
        layout: { background: { type: ColorType.Solid, color: cssVar("--card", "#ffffff") }, textColor: cssVar("--text-secondary", "#666666") },
        grid: { vertLines: { color: cssVar("--border-light", "#eeeeee") }, horzLines: { color: cssVar("--border-light", "#eeeeee") } },
      }),
    );
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mo.disconnect(); c.remove(); chart.current = null; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, t] = await Promise.all([fetchPct(sid, range), fetchPct("^TWII", range)]);
      if (!alive || !stockS.current || !twiiS.current) return;
      stockS.current.setData(s as never);
      twiiS.current.setData(t as never);
      chart.current?.timeScale().fitContent();
      setRet({ stock: s.length ? s[s.length - 1].value : null, twii: t.length ? t[t.length - 1].value : null });
    })();
    return () => { alive = false; };
  }, [sid, range]);

  const cls = (v: number | null) => (v == null ? "" : v >= 0 ? "up" : "down");
  const pct = (v: number | null) => (v != null ? (v >= 0 ? "+" : "") + v.toFixed(2) + "%" : "—");

  return (
    <div className="chart-box">
      <div className="chart-toolbar">
        <span className="chart-label">績效表現</span>
        {RANGES.map(([lbl, r]) => (
          <button key={r} className={`tf-btn ${range === r ? "active" : ""}`} onClick={() => setRange(r)} type="button">{lbl}</button>
        ))}
      </div>
      <div className="perf-legend">
        <span><i style={{ background: "var(--gold)" }} />{name} <b className={cls(ret.stock)}>{pct(ret.stock)}</b></span>
        <span><i style={{ background: "var(--teal)" }} />加權指數 <b className={cls(ret.twii)}>{pct(ret.twii)}</b></span>
      </div>
      <div ref={wrap} style={{ width: "100%", height: 260 }} />
    </div>
  );
}
