"use client";

import { useMemo, useState } from "react";

/* ═══════════════════════════════════════════
   個股評分（自訂條件與權重）
   從舊站 js/ui.js 移植；與 update.py 伺服器評分邏輯對齊。
   有 raw 時依 test() 重算，否則沿用伺服器 criteria.pass。
   設定存於 localStorage: screener:scoreCfg
   ═══════════════════════════════════════════ */

export type Raw = {
  dd?: number; fd?: number; td?: number;
  main_net?: number; retail_net?: number;
  vol?: number; avg_vol5?: number;
  pe?: number; pb?: number; dy?: number;
  yoy?: number; mom?: number;
  consec_up?: boolean; d3_chg?: number; rsv?: number;
  ma5?: number; ma10?: number; ma20?: number; ma60?: number;
  close?: number;
};
type CriteriaItem = { text: string; pass: boolean };
export type Criteria = { chip?: CriteriaItem[]; fundamental?: CriteriaItem[]; technical?: CriteriaItem[] };
type Dim = "chip" | "fundamental" | "technical";

const SCORE_CRITERIA: Record<Dim, { id: string; text: string; test: (r: Raw) => boolean }[]> = {
  chip: [
    { id: "c1", text: "主力連買 >= 3 日", test: (r) => (r.dd ?? 0) >= 3 || (r.fd ?? 0) >= 3 },
    { id: "c2", text: "近3日量大，曾單日買超 > 1,000張", test: (r) => Math.abs(r.main_net ?? 0) > 1000 },
    { id: "c3", text: "近5日籌碼集中度為正", test: (r) => (r.main_net ?? 0) > 0 },
    { id: "c4", text: "外資、投信同時連買 >= 2 天", test: (r) => (r.fd ?? 0) >= 2 && (r.td ?? 0) >= 2 },
    { id: "c5", text: "中長線主力券商連續買超", test: (r) => (r.fd ?? 0) >= 5 || (r.dd ?? 0) >= 5 },
    { id: "c6", text: "短期最威券商連續買超", test: (r) => (r.fd ?? 0) >= 3 || (r.dd ?? 0) >= 3 },
    { id: "c7", text: "短期股懂券商連續買超", test: (r) => (r.td ?? 0) >= 2 },
    { id: "c8", text: "法人或主力大買重點量增", test: (r) => (r.main_net ?? 0) > 0 && (r.vol ?? 0) > (r.avg_vol5 ?? r.vol ?? 0) },
    { id: "c9", text: "前10大交易分點(20日)買超 > 賣超", test: (r) => (r.main_net ?? 0) > 0 },
    { id: "c10", text: "近1週大戶加碼且羊群減碼", test: (r) => (r.main_net ?? 0) > 0 && (r.retail_net ?? 0) < 0 },
  ],
  fundamental: [
    { id: "f1", text: "本益比 >= 10", test: (r) => (r.pe ?? 0) >= 10 },
    { id: "f2", text: "股價淨值比 >= 0.5", test: (r) => (r.pb ?? 0) >= 0.5 },
    { id: "f3", text: "現金股利殖利率 > 3%", test: (r) => (r.dy ?? 0) > 3 },
    { id: "f4", text: "月營收創10個月以上新高", test: (r) => (r.yoy ?? 0) > 30 },
    { id: "f5", text: "最近一期月營收MOM > 0", test: (r) => (r.mom ?? 0) > 0 },
    { id: "f6", text: "最近一期季度營業淨利 > 0", test: (r) => (r.pe ?? 0) > 0 },
    { id: "f7", text: "最近一期季度稅後淨利 > 0", test: (r) => (r.pe ?? 0) > 0 },
    { id: "f8", text: "最近一期季度每股盈餘 > 1", test: (r) => (r.pe ?? 0) > 0 && (r.close ?? 0) / (r.pe ?? 1) > 1 },
    { id: "f9", text: "最近一期年度ROA >= 5", test: (r) => (r.pb ?? 0) > 1 && (r.pe ?? 0) > 0 && (r.pe ?? 0) < 30 },
    { id: "f10", text: "最近一期年度ROE >= 8", test: (r) => (r.pb ?? 0) > 1 && (r.pe ?? 0) > 0 && (r.pe ?? 0) < 25 },
  ],
  technical: [
    { id: "t1", text: "收盤價連3日漲", test: (r) => !!r.consec_up },
    { id: "t2", text: "3日漲幅 > 5%", test: (r) => (r.d3_chg ?? 0) > 5 },
    { id: "t3", text: "連3日打敗大盤", test: (r) => !!r.consec_up },
    { id: "t4", text: "KD黃金交叉", test: (r) => (r.rsv ?? 0) > 20 && (r.rsv ?? 0) < 80 },
    { id: "t5", text: "RSI多頭趨勢", test: (r) => (r.rsv ?? 0) > 50 },
    { id: "t6", text: "MACD多頭趨勢", test: (r) => !!r.ma5 && !!r.ma20 && (r.ma5 ?? 0) > (r.ma20 ?? 0) },
    { id: "t7", text: "收盤價 > 週線(MA5)", test: (r) => !!r.ma5 && (r.close ?? 0) > (r.ma5 ?? 0) },
    { id: "t8", text: "收盤價 > 月線(MA20)", test: (r) => !!r.ma20 && (r.close ?? 0) > (r.ma20 ?? 0) },
    { id: "t9", text: "月線 > 季線(MA60)", test: (r) => !!r.ma20 && !!r.ma60 && (r.ma20 ?? 0) > (r.ma60 ?? 0) },
    { id: "t10", text: "均線多頭排列(5>10>20)", test: (r) => !!r.ma5 && !!r.ma10 && !!r.ma20 && (r.ma5 ?? 0) > (r.ma10 ?? 0) && (r.ma10 ?? 0) > (r.ma20 ?? 0) },
  ],
};
const DIMS: Dim[] = ["chip", "fundamental", "technical"];
const DIM_LABEL: Record<Dim, string> = { chip: "籌碼面", fundamental: "基本面", technical: "技術面" };
const KEY = "screener:scoreCfg";

type ItemCfg = { on: boolean; w: number };
type Cfg = { dims: Record<Dim, boolean> } & Record<Dim, Record<string, ItemCfg>>;

function defaultCfg(): Cfg {
  const cfg = { dims: { chip: true, fundamental: true, technical: true } } as Cfg;
  DIMS.forEach((dim) => {
    cfg[dim] = {};
    SCORE_CRITERIA[dim].forEach((c) => { cfg[dim][c.id] = { on: true, w: 1 }; });
  });
  return cfg;
}
function loadCfg(): Cfg {
  const d = defaultCfg();
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!s) return d;
    DIMS.forEach((dim) => {
      if (typeof s.dims?.[dim] === "boolean") d.dims[dim] = s.dims[dim];
      SCORE_CRITERIA[dim].forEach((c) => {
        const v = s[dim]?.[c.id];
        if (v) {
          d[dim][c.id].on = v.on !== false;
          d[dim][c.id].w = Math.max(1, Math.min(10, Number(v.w) || 1));
        }
      });
    });
  } catch { /* ignore */ }
  return d;
}
function isDefaultCfg(cfg: Cfg): boolean {
  return JSON.stringify(cfg) === JSON.stringify(defaultCfg());
}

function badge(n: number) { const p = n / 10; return p >= 0.7 ? "badge-high" : p >= 0.4 ? "badge-mid" : "badge-low"; }
function comment(t: number) { return t >= 25 ? "多數條件符合" : t >= 20 ? "逾半條件符合" : t >= 15 ? "部分條件符合" : t >= 10 ? "少數條件符合" : "多數條件未符合"; }
function color(t: number) { return t >= 25 ? "var(--green)" : t >= 20 ? "var(--teal)" : t >= 15 ? "var(--gold)" : "var(--red)"; }

type Row = { id: string; text: string; pass: boolean; on: boolean; w: number };
function computeDim(dim: Dim, raw: Raw | undefined, criteria: Criteria, cfg: Cfg): Row[] {
  const serverList = criteria[dim] ?? [];
  return SCORE_CRITERIA[dim].map((c, i) => {
    const s = cfg[dim][c.id];
    let pass: boolean;
    if (raw) {
      try { pass = c.test(raw); } catch { pass = !!serverList[i]?.pass; }
    } else {
      pass = !!serverList[i]?.pass;
    }
    return { id: c.id, text: c.text, pass, on: s.on, w: s.w };
  });
}
function dimScore(rows: Row[]): number {
  const wSum = rows.reduce((s, c) => s + (c.on ? c.w : 0), 0);
  const hit = rows.reduce((s, c) => s + (c.on && c.pass ? c.w : 0), 0);
  return wSum ? Math.round((10 * hit) / wSum) : 0;
}

const Check = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
const Cross = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>;
const Chev = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>;

export default function ScoreCard({ raw, criteria }: { raw?: Raw; criteria: Criteria }) {
  const [cfg, setCfg] = useState<Cfg>(() => (typeof window === "undefined" ? defaultCfg() : loadCfg()));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Cfg>(cfg);
  const [openDims, setOpenDims] = useState<Record<Dim, boolean>>({ chip: false, fundamental: false, technical: false });

  const { dimRows, total } = useMemo(() => {
    const dimRows = {} as Record<Dim, Row[]>;
    let total = 0;
    DIMS.forEach((dim) => {
      const rows = computeDim(dim, raw, criteria, cfg);
      dimRows[dim] = rows;
      total += cfg.dims[dim] ? dimScore(rows) : 0;
    });
    return { dimRows, total };
  }, [raw, criteria, cfg]);

  const custom = !isDefaultCfg(cfg);

  const openModal = () => { setDraft(loadCfg()); setOpen(true); };
  const apply = () => {
    try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* ignore */ }
    setCfg(structuredClone(draft));
    setOpen(false);
  };
  const reset = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setDraft(defaultCfg()); };
  const toggle = (dim: Dim, id: string) =>
    setDraft((d) => { const n = structuredClone(d); n[dim][id].on = !n[dim][id].on; return n; });
  const setWeight = (dim: Dim, id: string, v: string) =>
    setDraft((d) => { const n = structuredClone(d); n[dim][id].w = Math.max(1, Math.min(10, Math.round(Number(v) || 1))); return n; });

  const hasRaw = !!raw;

  return (
    <div className="score-section">
      <div className="score-total">
        <div className="score-total-left">
          <div className="score-ring" style={{ background: color(total) }}>{total}/30</div>
          <div>
            <div className="score-total-label">
              總評分：{comment(total)} {custom && <span className="score-cfg-hint">（自訂評分）</span>}
            </div>
            <div className="score-total-comment">
              {DIMS.map((dim, i) => (
                <span key={dim}>{i > 0 && " ・ "}{DIM_LABEL[dim]} {cfg.dims[dim] ? dimScore(dimRows[dim]) : 0}/10</span>
              ))}
            </div>
            <div className="score-cfg-hint" style={{ marginTop: 4 }}>條件符合度統計，非投資建議</div>
          </div>
        </div>
        <button className="btn btn-sm score-cfg-btn" onClick={openModal} type="button">評分設定</button>
      </div>

      {DIMS.map((dim) => (
        <div key={dim} className={`score-dim ${openDims[dim] ? "open" : ""}`}>
          <div className="score-dim-header" onClick={() => setOpenDims((s) => ({ ...s, [dim]: !s[dim] }))}>
            <span className="score-dim-arrow"><Chev /></span>
            <span className="score-dim-title">{DIM_LABEL[dim]}</span>
            <span className={`score-dim-badge ${badge(dimScore(dimRows[dim]))}`}>{dimScore(dimRows[dim])}/10</span>
          </div>
          <div className="score-dim-list">
            {dimRows[dim].map((c) => (
              <div key={c.id} className={`criteria ${c.pass ? "pass" : "fail"}`} style={{ opacity: c.on ? 1 : 0.45 }}>
                <span className="icon">{c.pass ? <Check /> : <Cross />}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {open && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setOpen(false)} aria-label="關閉" type="button">✕</button>
            <div className="modal-title">評分條件設定</div>
            {DIMS.map((dim) => (
              <div key={dim} className="cfg-dim">
                <div className="cfg-dim-head">
                  <span className="cfg-dim-name">{DIM_LABEL[dim]}</span>
                  <span className="cfg-dim-score">{SCORE_CRITERIA[dim].length} 項條件</span>
                </div>
                {SCORE_CRITERIA[dim].map((c, i) => {
                  const s = draft[dim][c.id];
                  const pass = hasRaw ? (() => { try { return c.test(raw!); } catch { return false; } })() : !!criteria[dim]?.[i]?.pass;
                  return (
                    <div key={c.id} className={`cfg-item ${s.on ? "" : "disabled"}`}>
                      <input type="checkbox" checked={s.on} onChange={() => toggle(dim, c.id)} />
                      <span className="cfg-text">{c.text}</span>
                      <span className="cfg-pass">{pass ? "命中" : "未命中"}</span>
                      <input type="number" className="cfg-weight" min={1} max={10} value={s.w} title="權重"
                        onChange={(e) => setWeight(dim, c.id, e.target.value)} />
                    </div>
                  );
                })}
              </div>
            ))}
            <p className="score-cfg-hint" style={{ marginTop: 4 }}>
              {hasRaw ? "可勾選要計分的條件並調整權重（1–10）。" : "目前資料未含評分原始值，僅可勾選/調整權重；重新執行 update.py 後可依原始值重算。"}
            </p>
            <div className="cfg-actions">
              <button className="btn" onClick={reset} type="button">重設預設</button>
              <button className="btn primary" onClick={apply} type="button">套用</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
