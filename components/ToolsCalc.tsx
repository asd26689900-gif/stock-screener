"use client";

import { useState } from "react";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="calc-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ToolsCalc() {
  const [r, setR] = useState({ buy: "100", sell: "120", lots: "1", disc: "0.28", daytrade: "0" });
  const [rOut, setROut] = useState("");
  const [y, setY] = useState({ div: "5", price: "100", target: "5" });
  const [yOut, setYOut] = useState("");
  const [d, setD] = useState({ monthly: "10000", rate: "8", years: "20" });
  const [dOut, setDOut] = useState("");
  const [p, setP] = useState({ capital: "1000000", riskPct: "2", entry: "100", stop: "95" });
  const [pOut, setPOut] = useState("");
  const [lim, setLim] = useState({ ref: "100", pct: "10" });
  const [limOut, setLimOut] = useState("");
  const [avg, setAvg] = useState({ shares1: "1000", cost1: "100", shares2: "1000", cost2: "90" });
  const [avgOut, setAvgOut] = useState("");

  const calcReturn = () => {
    const buy = num(r.buy), sell = num(r.sell), lots = num(r.lots) || 1;
    const disc = num(r.disc), daytrade = num(r.daytrade);
    if (!buy || !sell) return;
    const shares = lots * 1000;
    const buyAmt = buy * shares, sellAmt = sell * shares;
    const feeRate = 0.001425 * disc;
    const buyFee = Math.max(Math.round(buyAmt * feeRate), 1);
    const sellFee = Math.max(Math.round(sellAmt * feeRate), 1);
    const tax = Math.round(sellAmt * (daytrade ? 0.0015 : 0.003));
    const totalCost = buyFee + sellFee + tax;
    const profit = sellAmt - buyAmt - totalCost;
    setROut(
      `<div>買進金額：${fmt(buyAmt, 0)} 元</div><div>賣出金額：${fmt(sellAmt, 0)} 元</div><div>手續費(買)：${fmt(buyFee, 0)} 元</div><div>手續費(賣)：${fmt(sellFee, 0)} 元</div><div>證交稅：${fmt(tax, 0)} 元${daytrade ? " (當沖減半)" : ""}</div><div>交易成本合計：${fmt(totalCost, 0)} 元</div><hr/><div>實際損益：<b class="big ${pctClass(profit)}">${profit > 0 ? "+" : ""}${fmt(profit, 0)} 元</b></div><div>報酬率：<b class="${pctClass(profit)}">${((profit / buyAmt) * 100).toFixed(2)}%</b></div>`,
    );
  };

  const calcYield = () => {
    const div = num(y.div), price = num(y.price), target = num(y.target);
    if (!div) return;
    const curYield = price ? (div / price * 100).toFixed(2) : "—";
    const fair = target ? (div / (target / 100)).toFixed(1) : "—";
    const cheap = target ? (div / ((target + 1) / 100)).toFixed(1) : "—";
    const exp = target ? (div / ((target - 1) / 100)).toFixed(1) : "—";
    setYOut(`<div>目前殖利率：${curYield}%</div><div>合理價（${fmt(target, 1)}%）：${fair} 元</div><div>便宜價（${fmt(target + 1, 1)}%）：${cheap} 元</div><div>昂貴價（${fmt(target - 1, 1)}%）：${exp} 元</div>`);
  };

  const calcDCA = () => {
    const monthly = num(d.monthly), rate = num(d.rate) / 100 / 12, years = num(d.years);
    let total = 0;
    for (let i = 0; i < years * 12; i++) total = (total + monthly) * (1 + rate);
    const invested = monthly * years * 12;
    setDOut(`<div>投入本金：${fmt(invested, 0)} 元</div><div>期末價值：<b class="big up">${fmt(total, 0)} 元</b></div><div>累積報酬：<b class="${pctClass(total - invested)}">${((total - invested) / invested * 100).toFixed(1)}%</b></div>`);
  };

  const calcLimit = () => {
    const ref = num(lim.ref), pct = num(lim.pct);
    if (!ref) return;
    // 台股漲跌停 tick 規則
    const tick = (p: number) => p < 10 ? 0.01 : p < 50 ? 0.05 : p < 100 ? 0.1 : p < 500 ? 0.5 : p < 1000 ? 1 : 5;
    const raw_up = ref * (1 + pct / 100);
    const raw_dn = ref * (1 - pct / 100);
    const t = tick(ref);
    const up = Math.round(raw_up / t) * t;
    const dn = Math.round(raw_dn / t) * t;
    setLimOut(`<div>漲停價：<b class="big up">${fmt(up, 2)} 元</b>（+${pct}%）</div><div>跌停價：<b class="big down">${fmt(dn, 2)} 元</b>（-${pct}%）</div><div>價格級距：${t} 元</div>`);
  };

  const calcAvg = () => {
    const s1 = num(avg.shares1), c1 = num(avg.cost1), s2 = num(avg.shares2), c2 = num(avg.cost2);
    if (!s1 || !c1 || !s2 || !c2) return;
    const totalShares = s1 + s2;
    const totalCost = s1 * c1 + s2 * c2;
    const newAvg = totalCost / totalShares;
    const chg = ((newAvg - c1) / c1 * 100);
    setAvgOut(`<div>原持股成本：${fmt(s1 * c1, 0)} 元</div><div>加碼金額：${fmt(s2 * c2, 0)} 元</div><hr/><div>攤平後總股數：<b>${fmt(totalShares, 0)} 股</b></div><div>攤平後均價：<b class="big">${fmt(newAvg, 2)} 元</b></div><div>成本變動：<b class="${pctClass(chg)}">${fmtSigned(chg)}%</b>（${fmtSigned(newAvg - c1, 2)} 元）</div>`);
  };

  const calcPosition = () => {
    const capital = num(p.capital), riskPct = num(p.riskPct), entry = num(p.entry), stop = num(p.stop);
    if (!capital || !entry || !stop || entry === stop) return;
    const maxRisk = capital * (riskPct / 100);
    const riskPerShare = Math.abs(entry - stop);
    const maxShares = Math.floor(maxRisk / riskPerShare);
    const lots = Math.floor(maxShares / 1000);
    const investAmt = lots * 1000 * entry;
    const investPct = (investAmt / capital * 100).toFixed(1);
    setPOut(
      `<div>最大可承受虧損：${fmt(maxRisk, 0)} 元</div><div>每股風險：${fmt(riskPerShare, 2)} 元（${(riskPerShare / entry * 100).toFixed(2)}%）</div><hr/><div>建議張數：<b class="big">${lots} 張</b>（${fmt(lots * 1000, 0)} 股）</div><div>所需資金：${fmt(investAmt, 0)} 元（佔總資金 ${investPct}%）</div><div>最大虧損：${fmt(lots * 1000 * riskPerShare, 0)} 元</div>`,
    );
  };

  const inputStyle = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 13.5, fontFamily: "var(--font-mono)" } as const;

  return (
    <>
      <div className="tool-card">
        <div className="tool-title">股票報酬率計算機</div>
        <div className="calc-form">
          <Field label="買進價格"><input type="number" value={r.buy} onChange={(e) => setR((f) => ({ ...f, buy: e.target.value }))} style={inputStyle} /></Field>
          <Field label="賣出價格"><input type="number" value={r.sell} onChange={(e) => setR((f) => ({ ...f, sell: e.target.value }))} style={inputStyle} /></Field>
          <Field label="張數"><input type="number" min="1" value={r.lots} onChange={(e) => setR((f) => ({ ...f, lots: e.target.value }))} style={inputStyle} /></Field>
          <Field label="手續費折扣">
            <select value={r.disc} onChange={(e) => setR((f) => ({ ...f, disc: e.target.value }))} style={inputStyle}>
              <option value="1">無折扣</option><option value="0.6">6折</option><option value="0.5">5折</option><option value="0.38">3.8折</option><option value="0.28">2.8折</option>
            </select>
          </Field>
          <Field label="當沖減稅">
            <select value={r.daytrade} onChange={(e) => setR((f) => ({ ...f, daytrade: e.target.value }))} style={inputStyle}>
              <option value="0">否</option><option value="1">是（證交稅減半）</option>
            </select>
          </Field>
        </div>
        <button type="button" className="calc-btn" onClick={calcReturn}>計算</button>
        {rOut && <div className="result-box show" dangerouslySetInnerHTML={{ __html: rOut }} />}
      </div>

      <div className="tool-card">
        <div className="tool-title">殖利率 &amp; 合理價計算機</div>
        <div className="calc-form">
          <Field label="現金股利"><input type="number" value={y.div} onChange={(e) => setY((f) => ({ ...f, div: e.target.value }))} style={inputStyle} /></Field>
          <Field label="目前股價"><input type="number" value={y.price} onChange={(e) => setY((f) => ({ ...f, price: e.target.value }))} style={inputStyle} /></Field>
          <Field label="目標殖利率%"><input type="number" value={y.target} onChange={(e) => setY((f) => ({ ...f, target: e.target.value }))} style={inputStyle} /></Field>
        </div>
        <button type="button" className="calc-btn" onClick={calcYield}>計算</button>
        {yOut && <div className="result-box show" dangerouslySetInnerHTML={{ __html: yOut }} />}
      </div>

      <div className="tool-card">
        <div className="tool-title">定期定額複利試算</div>
        <div className="calc-form">
          <Field label="每月投入"><input type="number" value={d.monthly} onChange={(e) => setD((f) => ({ ...f, monthly: e.target.value }))} style={inputStyle} /></Field>
          <Field label="年化報酬率%"><input type="number" value={d.rate} onChange={(e) => setD((f) => ({ ...f, rate: e.target.value }))} style={inputStyle} /></Field>
          <Field label="投資年數"><input type="number" value={d.years} onChange={(e) => setD((f) => ({ ...f, years: e.target.value }))} style={inputStyle} /></Field>
        </div>
        <button type="button" className="calc-btn" onClick={calcDCA}>計算</button>
        {dOut && <div className="result-box show" dangerouslySetInnerHTML={{ __html: dOut }} />}
      </div>

      <div className="tool-card">
        <div className="tool-title">漲跌停預估</div>
        <div className="calc-form">
          <Field label="昨日收盤價"><input type="number" value={lim.ref} onChange={(e) => setLim((f) => ({ ...f, ref: e.target.value }))} style={inputStyle} /></Field>
          <Field label="漲跌幅限制%">
            <select value={lim.pct} onChange={(e) => setLim((f) => ({ ...f, pct: e.target.value }))} style={inputStyle}>
              <option value="10">10%（一般）</option><option value="5">5%（第一上市）</option>
            </select>
          </Field>
        </div>
        <button type="button" className="calc-btn" onClick={calcLimit}>計算</button>
        {limOut && <div className="result-box show" dangerouslySetInnerHTML={{ __html: limOut }} />}
      </div>

      <div className="tool-card">
        <div className="tool-title">成本攤平計算機</div>
        <div className="calc-form">
          <Field label="原持股數"><input type="number" value={avg.shares1} onChange={(e) => setAvg((f) => ({ ...f, shares1: e.target.value }))} style={inputStyle} /></Field>
          <Field label="原成本價"><input type="number" value={avg.cost1} onChange={(e) => setAvg((f) => ({ ...f, cost1: e.target.value }))} style={inputStyle} /></Field>
          <Field label="加碼股數"><input type="number" value={avg.shares2} onChange={(e) => setAvg((f) => ({ ...f, shares2: e.target.value }))} style={inputStyle} /></Field>
          <Field label="加碼價格"><input type="number" value={avg.cost2} onChange={(e) => setAvg((f) => ({ ...f, cost2: e.target.value }))} style={inputStyle} /></Field>
        </div>
        <button type="button" className="calc-btn" onClick={calcAvg}>計算</button>
        {avgOut && <div className="result-box show" dangerouslySetInnerHTML={{ __html: avgOut }} />}
      </div>

      <div className="tool-card">
        <div className="tool-title">部位計算機</div>
        <div className="calc-form">
          <Field label="總資金"><input type="number" value={p.capital} onChange={(e) => setP((f) => ({ ...f, capital: e.target.value }))} style={inputStyle} /></Field>
          <Field label="風險比例%"><input type="number" step="0.5" value={p.riskPct} onChange={(e) => setP((f) => ({ ...f, riskPct: e.target.value }))} style={inputStyle} /></Field>
          <Field label="進場價"><input type="number" value={p.entry} onChange={(e) => setP((f) => ({ ...f, entry: e.target.value }))} style={inputStyle} /></Field>
          <Field label="停損價"><input type="number" value={p.stop} onChange={(e) => setP((f) => ({ ...f, stop: e.target.value }))} style={inputStyle} /></Field>
        </div>
        <button type="button" className="calc-btn" onClick={calcPosition}>計算</button>
        {pOut && <div className="result-box show" dangerouslySetInnerHTML={{ __html: pOut }} />}
      </div>
    </>
  );
}
