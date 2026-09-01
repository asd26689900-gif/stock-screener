"use client";

import { useEffect, useRef, useState } from "react";
import { ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";

export type InstRow = { date: string; foreign_net: number; trust_net: number; dealer_net: number };

const COLORS = ["#2962FF", "#FF9800", "#9C27B0"];
const LABELS = ["外資", "投信", "自營"];
const KEYS = ["foreign_net", "trust_net", "dealer_net"] as const;

function tz(s: string): UTCTimestamp {
  return Math.floor(new Date(s + "T00:00:00+08:00").getTime() / 1000) as UTCTimestamp;
}

function cssVar(name: string, fb: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
  } catch {
    return fb;
  }
}

function MiniChart({
  rows,
  flags,
  mode,
  height,
}: {
  rows: InstRow[];
  flags: boolean[];
  mode: "bar" | "cum";
  height: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Histogram" | "Line">[]>([]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: cssVar("--card", "#ffffff") },
        textColor: cssVar("--text-secondary", "#666666"),
        fontSize: 10,
      },
      grid: { vertLines: { color: cssVar("--border-light", "#eeeeee") }, horzLines: { color: cssVar("--border-light", "#eeeeee") } },
      rightPriceScale: { borderColor: cssVar("--border", "#dddddd") },
      timeScale: { borderColor: cssVar("--border", "#dddddd"), timeVisible: false, rightOffset: 2, barSpacing: 10 },
      crosshair: { vertLine: { labelBackgroundColor: "#8A6508" }, horzLine: { labelBackgroundColor: "#8A6508" } },
      localization: { locale: "zh-TW" },
    });
    seriesRef.current = KEYS.map((_, ci) =>
      mode === "bar"
        ? chart.addHistogramSeries({ priceFormat: { type: "price", precision: 0 }, color: COLORS[ci], priceLineVisible: false, lastValueVisible: false })
        : chart.addLineSeries({ color: COLORS[ci], lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }),
    );
    chartRef.current = chart;
    const mo = new MutationObserver(() =>
      chart.applyOptions({
        layout: { background: { type: ColorType.Solid, color: cssVar("--card", "#ffffff") }, textColor: cssVar("--text-secondary", "#666666") },
        grid: { vertLines: { color: cssVar("--border-light", "#eeeeee") }, horzLines: { color: cssVar("--border-light", "#eeeeee") } },
        rightPriceScale: { borderColor: cssVar("--border", "#dddddd") },
        timeScale: { borderColor: cssVar("--border", "#dddddd") },
      }),
    );
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mo.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [mode, height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (mode === "bar") {
      KEYS.forEach((k, ci) => {
        const s = seriesRef.current[ci] as ISeriesApi<"Histogram">;
        s.applyOptions({ visible: flags[ci], color: COLORS[ci] });
        s.setData(
          flags[ci]
            ? rows.map((r) => ({ time: tz(r.date), value: Math.round((r[k] ?? 0) / 1000), color: COLORS[ci] }))
            : [],
        );
      });
    } else {
      KEYS.forEach((k, ci) => {
        const s = seriesRef.current[ci] as ISeriesApi<"Line">;
        s.applyOptions({ visible: flags[ci] });
        if (!flags[ci]) {
          s.setData([]);
          return;
        }
        let acc = 0;
        s.setData(rows.map((r) => {
          acc += (r[k] ?? 0) / 1000;
          return { time: tz(r.date), value: Math.round(acc) };
        }));
      });
    }
  }, [rows, flags, mode]);

  return <div ref={wrapRef} style={{ height }} />;
}

export default function InstitutionalPanel({ rows }: { rows: InstRow[] }) {
  const [flags, setFlags] = useState<boolean[]>([true, true, true]);
  const data = rows.slice(-90);
  return (
    <div className="card">
      <div className="section-title" style={{ marginTop: 0 }}>
        法人買賣超（張）
        <span style={{ display: "inline-flex", gap: 6, marginLeft: "auto" }}>
          {LABELS.map((label, ci) => (
            <button
              key={label}
              type="button"
              className={`toggle-chip ${flags[ci] ? "on" : ""}`}
              style={{ color: COLORS[ci], borderColor: flags[ci] ? COLORS[ci] : undefined }}
              onClick={() => setFlags((prev) => prev.map((v, i) => (i === ci ? !v : v)))}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      <div className="mega-col-title">當日柱狀</div>
      <MiniChart rows={data} flags={flags} mode="bar" height={170} />
      <div className="mega-col-title" style={{ marginTop: 12 }}>
        累計曲線（90 日）
      </div>
      <MiniChart rows={data} flags={flags} mode="cum" height={170} />
      <p className="hint" style={{ marginTop: 8 }}>
        資料為三大法人個股買賣超（張），來源 TWSE，17:30 更新。
      </p>
    </div>
  );
}
