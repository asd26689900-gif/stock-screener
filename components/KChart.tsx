"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import SliderTabs from "./SliderTabs";

export type KBar = { d: string; o: number; h: number; l: number; c: number; v: number };
export type InstByDate = Record<string, [number, number, number]>;

const MA_COLORS: Record<number, string> = { 5: "#2962FF", 10: "#FF9800", 20: "#9C27B0", 60: "#8B8780" };
const IND_COLORS: Record<string, string> = { k: "#2962FF", d: "#FF9800", rsi: "#D4A840", dif: "#D4A840", sig: "#5AADAB" };
const INST_COLORS = ["#2962FF", "#FF9800", "#9C27B0"];
const INST_LABELS = ["外資", "投信", "自營"];

function tzTime(s: string): UTCTimestamp | string {
  if (s.length >= 16) {
    const t = new Date(s.slice(0, 10) + "T" + s.slice(11, 16) + ":00+08:00");
    return Math.floor(t.getTime() / 1000) as UTCTimestamp;
  }
  return s.slice(0, 10);
}

function cssVar(name: string, fb: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
  } catch {
    return fb;
  }
}

function calcMA(data: KBar[], n: number): (number | null)[] {
  const r: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < n - 1) {
      r.push(null);
      continue;
    }
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += data[j].c;
    r.push(s / n);
  }
  return r;
}

function calcBOLL(data: KBar[], n = 20, k = 2) {
  const mid: (number | null)[] = [], up: (number | null)[] = [], low: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < n - 1) {
      mid.push(null); up.push(null); low.push(null);
      continue;
    }
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += data[j].c;
    const m = s / n;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (data[j].c - m) * (data[j].c - m);
    const sd = Math.sqrt(v / n);
    mid.push(m); up.push(m + k * sd); low.push(m - k * sd);
  }
  return { mid, up, low };
}

function calcKD(data: KBar[]) {
  const k: number[] = [], d: number[] = [];
  let pk = 50, pd = 50;
  for (let i = 0; i < data.length; i++) {
    if (i < 8) {
      k.push(50); d.push(50);
      continue;
    }
    const seg = data.slice(i - 8, i + 1);
    const h = Math.max(...seg.map((x) => x.h)), l = Math.min(...seg.map((x) => x.l));
    const rsv = h !== l ? ((data[i].c - l) / (h - l)) * 100 : 50;
    pk = (2 / 3) * pk + (1 / 3) * rsv;
    pd = (2 / 3) * pd + (1 / 3) * pk;
    k.push(pk); d.push(pd);
  }
  return { k, d };
}

function calcRSI(data: KBar[], n = 14) {
  const r: number[] = [];
  let ag = 0, al = 0;
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      r.push(50);
      continue;
    }
    const chg = data[i].c - data[i - 1].c;
    const g = chg > 0 ? chg : 0, l = chg < 0 ? -chg : 0;
    if (i <= n) {
      ag = (ag * (i - 1) + g) / i;
      al = (al * (i - 1) + l) / i;
    } else {
      ag = (ag * (n - 1) + g) / n;
      al = (al * (n - 1) + l) / n;
    }
    r.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return r;
}

function calcMACD(data: KBar[]) {
  let e12 = data[0]?.c ?? 0, e26 = data[0]?.c ?? 0, sig = 0;
  const dif: number[] = [], macd: number[] = [], osc: number[] = [];
  for (let i = 0; i < data.length; i++) {
    e12 = i === 0 ? data[i].c : (e12 * 11) / 13 + (data[i].c * 2) / 13;
    e26 = i === 0 ? data[i].c : (e26 * 25) / 27 + (data[i].c * 2) / 27;
    const dd = e12 - e26;
    sig = i === 0 ? dd : (sig * 8) / 10 + (dd * 2) / 10;
    dif.push(dd); macd.push(sig); osc.push((dd - sig) * 2);
  }
  return { dif, macd, osc };
}

function Legend({ b, prev, showInst, idx, maActive, maData, indType, indData }: {
  b: KBar | null; prev: KBar | null; showInst: boolean; idx: number;
  maActive: number[]; maData: Record<number, (number | null)[]>;
  indType: "kd" | "rsi" | "macd"; indData: { a: number[]; b: number[]; osc: number[] };
}) {
  const cur = b ?? prev;
  if (!cur) return null;
  const chg = prev ? cur.c - prev.c : 0;
  const cls = chg > 0 ? "up" : chg < 0 ? "down" : "flat";
  const fi = idx >= 0 ? idx : 0;
  return (
    <div className="ohlcv-legend">
      <span>
        時間 <b>{cur.d.slice(5)}</b>
      </span>
      <span>
        開 <b>{cur.o.toFixed(2)}</b>
      </span>
      <span>
        高 <b className="up">{cur.h.toFixed(2)}</b>
      </span>
      <span>
        低 <b className="down">{cur.l.toFixed(2)}</b>
      </span>
      <span>
        收 <b className={cls}>{cur.c.toFixed(2)}</b>
      </span>
      <span className={cls}>
        {chg >= 0 ? "+" : ""}
        {chg.toFixed(2)}
      </span>
      <span>
        量 <b>{cur.v.toLocaleString("zh-TW")}</b> 張
      </span>
      {maActive.map((p) => {
        const v = maData[p]?.[fi];
        return v != null ? (
          <span key={p} style={{ color: MA_COLORS[p] }}>MA{p} <b>{v.toFixed(2)}</b></span>
        ) : null;
      })}
      {idx >= 0 && indType === "kd" && indData.a[fi] != null && (
        <span style={{ color: IND_COLORS.k }}>K <b>{indData.a[fi].toFixed(1)}</b>{" "}
          <span style={{ color: IND_COLORS.d }}>D <b>{indData.b[fi]?.toFixed(1)}</b></span>
        </span>
      )}
      {idx >= 0 && indType === "rsi" && indData.a[fi] != null && (
        <span style={{ color: IND_COLORS.rsi }}>RSI <b>{indData.a[fi].toFixed(1)}</b></span>
      )}
      {idx >= 0 && indType === "macd" && indData.a[fi] != null && (
        <span style={{ color: IND_COLORS.dif }}>DIF <b>{indData.a[fi].toFixed(2)}</b>{" "}
          <span style={{ color: IND_COLORS.sig }}>SIG <b>{indData.b[fi]?.toFixed(2)}</b></span>{" "}
          <span>OSC <b>{indData.osc[fi]?.toFixed(2)}</b></span>
        </span>
      )}
      {showInst && prev && <span className="hint">法人圖例請見下方開關</span>}
    </div>
  );
}

export default function KChart({
  bars,
  instByDate,
  height = 360,
  showMa = true,
  showInd = true,
  showInst = true,
}: {
  bars: KBar[];
  instByDate?: InstByDate;
  height?: number;
  showMa?: boolean;
  showInd?: boolean;
  showInst?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRef = useRef<Record<number, ISeriesApi<"Line">>>({});
  const bollRef = useRef<Record<string, ISeriesApi<"Line">>>({});
  const indRef = useRef<{ a: ISeriesApi<"Line">; b: ISeriesApi<"Line">; osc: ISeriesApi<"Histogram"> } | null>(null);
  const instRef = useRef<ISeriesApi<"Histogram">[]>([]);
  const priceLineRef = useRef<unknown>(null);
  const dataRef = useRef<KBar[]>([]);
  const [maActive, setMaActive] = useState<number[]>([5, 10, 20, 60]);
  const [boll, setBoll] = useState(false);
  const [ind, setInd] = useState<"kd" | "rsi" | "macd">("kd");
  const [instFlags, setInstFlags] = useState<boolean[]>([true, true, true]);
  const [legend, setLegend] = useState<{ b: KBar | null; prev: KBar | null; idx: number }>({ b: null, prev: null, idx: -1 });
  const maDataRef = useRef<Record<number, (number | null)[]>>({});
  const indTypeRef = useRef<"kd" | "rsi" | "macd">("kd");
  const indDataRef = useRef<{ a: number[]; b: number[]; osc: number[] }>({ a: [], b: [], osc: [] });

  // 建立 chart（一次）
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const card = cssVar("--card", "#ffffff");
    const text = cssVar("--text-secondary", "#666666");
    const grid = cssVar("--border-light", "#eeeeee");
    const border = cssVar("--border", "#dddddd");
    const chart = createChart(el, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: card },
        textColor: text,
        fontFamily: '-apple-system,"Segoe UI",Roboto,"PingFang TC","Microsoft JhengHei",sans-serif',
        fontSize: 11,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false, rightOffset: 3, barSpacing: 8 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { labelBackgroundColor: "#8A6508" }, horzLine: { labelBackgroundColor: "#8A6508" } },
      localization: { locale: "zh-TW" },
    });
    const candle = chart.addCandlestickSeries({
      upColor: "#B24A45",
      downColor: "#3A7357",
      borderVisible: false,
      wickUpColor: "#B24A45",
      wickDownColor: "#3A7357",
    });
    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(140,140,140,0.35)",
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    const ma: Record<number, ISeriesApi<"Line">> = {};
    [5, 10, 20, 60].forEach((p) => {
      ma[p] = chart.addLineSeries({
        color: MA_COLORS[p],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    });
    const bollSeries: Record<string, ISeriesApi<"Line">> = {};
    bollSeries.up = chart.addLineSeries({ color: "#78909C", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    bollSeries.mid = chart.addLineSeries({ color: "#78909C", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    bollSeries.low = chart.addLineSeries({ color: "#78909C", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const indSeries = {
      a: chart.addLineSeries({ color: "#2962FF", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceScaleId: "ind" }),
      b: chart.addLineSeries({ color: "#FF9800", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceScaleId: "ind" }),
      osc: chart.addHistogramSeries({ priceScaleId: "ind", priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "price", precision: 2 } }),
    };
    chart.priceScale("ind").applyOptions({ scaleMargins: { top: 0.86, bottom: 0.02 }, visible: false });
    const instSeries = [0, 1, 2].map((ci) =>
      chart.addHistogramSeries({
        priceScaleId: "inst",
        color: INST_COLORS[ci],
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: "price", precision: 0 },
      }),
    );
    chart.priceScale("inst").applyOptions({ scaleMargins: { top: 0.68, bottom: 0.18 }, visible: false });

    chartRef.current = chart;
    candleRef.current = candle;
    volRef.current = vol;
    maRef.current = ma;
    bollRef.current = bollSeries;
    indRef.current = indSeries;
    instRef.current = instSeries;

    const applyTheme = () => {
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: cssVar("--card", "#ffffff") },
          textColor: cssVar("--text-secondary", "#666666"),
        },
        grid: {
          vertLines: { color: cssVar("--border-light", "#eeeeee") },
          horzLines: { color: cssVar("--border-light", "#eeeeee") },
        },
        rightPriceScale: { borderColor: cssVar("--border", "#dddddd") },
        timeScale: { borderColor: cssVar("--border", "#dddddd") },
      });
    };
    const mo = new MutationObserver(applyTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    chart.subscribeCrosshairMove((param) => {
      const data = dataRef.current;
      if (!param.time || !param.seriesData?.get(candle) || !data.length) {
        setLegend({ b: null, prev: data[data.length - 2] ?? null, idx: data.length - 1 });
        return;
      }
      const i = data.findIndex((x) => tzTime(x.d) === param.time);
      setLegend({ b: data[i] ?? null, prev: i > 0 ? data[i - 1] : null, idx: i });
    });
    return () => {
      mo.disconnect();
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // bars 變更 → 重繪
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    const vol = volRef.current;
    if (!chart || !candle || !vol || !bars.length) return;
    dataRef.current = bars;
    const rows = bars.map((b) => ({ time: tzTime(b.d) as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c }));
    candle.setData(rows);
    vol.setData(bars.map((b) => ({ time: tzTime(b.d) as UTCTimestamp, value: b.v || 0, color: b.c >= b.o ? "rgba(178,74,69,0.45)" : "rgba(58,115,87,0.45)" })));
    [5, 10, 20, 60].forEach((p) => {
      const arr = calcMA(bars, p);
      maDataRef.current[p] = arr;
      maRef.current[p].setData(bars.map((b, i) => ({ time: tzTime(b.d) as UTCTimestamp, value: arr[i] })).filter((x) => x.value != null) as { time: UTCTimestamp; value: number }[]);
      maRef.current[p].applyOptions({ visible: showMa && maActive.includes(p) });
    });
    Object.values(bollRef.current).forEach((s) => s.applyOptions({ visible: showMa && boll }));
    if (showMa && boll) {
      const bb = calcBOLL(bars);
      (["up", "mid", "low"] as const).forEach((tag) => {
        bollRef.current[tag].setData(bars.map((x, i) => ({ time: tzTime(x.d) as UTCTimestamp, value: bb[tag][i] })).filter((x) => x.value != null) as { time: UTCTimestamp; value: number }[]);
      });
    }
    setLegend({ b: null, prev: bars[bars.length - 2] ?? null, idx: bars.length - 1 });
  }, [bars, maActive, boll, showMa]);

  // 指標重繪
  useEffect(() => {
    const indSeries = indRef.current;
    if (!indSeries || !showInd) return;
    const data = dataRef.current;
    if (!data.length) return;
    const mk = (arr: number[]) =>
      data.map((b, i) => ({ time: tzTime(b.d) as UTCTimestamp, value: arr[i] })).filter((x) => x.value != null && Number.isFinite(x.value)) as { time: UTCTimestamp; value: number }[];
    const hide = () => {
      indSeries.a.setData([]);
      indSeries.b.setData([]);
      indSeries.osc.setData([]);
    };
    indTypeRef.current = ind;
    if (ind === "kd") {
      const { k, d } = calcKD(data);
      indDataRef.current = { a: k, b: d, osc: [] };
      indSeries.a.applyOptions({ color: IND_COLORS.k });
      indSeries.b.applyOptions({ color: IND_COLORS.d });
      indSeries.a.setData(mk(k));
      indSeries.b.setData(mk(d));
      indSeries.osc.setData([]);
    } else if (ind === "rsi") {
      const r = calcRSI(data);
      indDataRef.current = { a: r, b: [], osc: [] };
      indSeries.a.applyOptions({ color: IND_COLORS.rsi });
      indSeries.b.setData([]);
      indSeries.osc.setData([]);
      indSeries.a.setData(mk(r));
    } else if (ind === "macd") {
      const { dif, macd, osc } = calcMACD(data);
      indDataRef.current = { a: dif, b: macd, osc };
      indSeries.a.applyOptions({ color: IND_COLORS.dif });
      indSeries.b.applyOptions({ color: IND_COLORS.sig });
      indSeries.a.setData(mk(dif));
      indSeries.b.setData(mk(macd));
      indSeries.osc.setData(
        data.map((b, i) => ({ time: tzTime(b.d) as UTCTimestamp, value: osc[i], color: osc[i] >= 0 ? "rgba(178,74,69,0.5)" : "rgba(58,115,87,0.5)" })).filter((x) => x.value != null && Number.isFinite(x.value)) as { time: UTCTimestamp; value: number; color: string }[],
      );
    } else hide();
  }, [ind, showInd, bars]);

  // 法人柱狀重繪
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !instByDate) return;
    const data = dataRef.current;
    instRef.current.forEach((s, ci) => {
      s.applyOptions({ visible: showInst && instFlags[ci], color: INST_COLORS[ci] });
      if (!showInst || !instFlags[ci]) {
        s.setData([]);
        return;
      }
      s.setData(
        data
          .map((b) => {
            const v = instByDate[String(b.d).slice(0, 10)];
            return v ? { time: tzTime(b.d) as UTCTimestamp, value: Math.round(v[ci]), color: INST_COLORS[ci] } : null;
          })
          .filter(Boolean) as { time: UTCTimestamp; value: number; color: string }[],
      );
    });
  }, [instByDate, instFlags, showInst, bars]);

  // 最新價線
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle || !bars.length) return;
    if (priceLineRef.current) {
      candle.removePriceLine(priceLineRef.current as never);
      priceLineRef.current = null;
    }
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2] ?? last;
    priceLineRef.current = candle.createPriceLine({
      price: last.c,
      color: last.c >= prev.c ? "#B24A45" : "#3A7357",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });
  }, [bars]);

  return (
    <div className="chart-box">
      <div className="chart-toolbar">
        {showMa && (
          <>
            <span className="ma-legend" style={{ marginBottom: 0 }}>
              {[5, 10, 20, 60].map((p) => (
                <span
                  key={p}
                  className={`ma-chip ${maActive.includes(p) ? "on" : ""}`}
                  style={{ borderColor: MA_COLORS[p] }}
                  onClick={() =>
                    setMaActive((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b)))
                  }
                >
                  MA{p}
                </span>
              ))}
            </span>
            <button type="button" className={`toggle-chip ${boll ? "on" : ""}`} onClick={() => setBoll((v) => !v)}>
              BOLL
            </button>
          </>
        )}
        {showInd && (
          <SliderTabs<"kd" | "rsi" | "macd">
            tabs={[
              { key: "kd", label: "KD" },
              { key: "rsi", label: "RSI" },
              { key: "macd", label: "MACD" },
            ]}
            active={ind}
            onChange={setInd}
          />
        )}
        {showInst && instByDate && (
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            {INST_LABELS.map((label, ci) => (
              <button
                key={label}
                type="button"
                className={`toggle-chip ${instFlags[ci] ? "on" : ""}`}
                style={{ color: INST_COLORS[ci], borderColor: instFlags[ci] ? INST_COLORS[ci] : undefined }}
                onClick={() => setInstFlags((prev) => prev.map((v, i) => (i === ci ? !v : v)))}
              >
                {label}
              </button>
            ))}
          </span>
        )}
      </div>
      <Legend b={legend.b} prev={legend.b ? legend.prev : bars[bars.length - 2] ?? null} showInst={showInst} idx={legend.idx} maActive={maActive} maData={maDataRef.current} indType={indTypeRef.current} indData={indDataRef.current} />
      <div className="chart-canvas" ref={wrapRef} style={{ height }} />
    </div>
  );
}
