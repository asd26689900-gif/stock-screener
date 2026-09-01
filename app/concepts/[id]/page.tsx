import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConcept, getConcepts } from "@/lib/concepts";
import { getConceptStocks, type ConceptStock } from "@/lib/stock";
import { getIndexReturns } from "@/lib/yahoo";
import { fmt, fmtSigned, pctClass } from "@/lib/format";
import ThemeTierGraph, { type GraphConcept } from "@/components/ThemeTierGraph";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await getConcept(id);
  return { title: c ? `${c.title} 概念股` : "題材概念股" };
}

function ret(v: number | null | undefined): string {
  return v == null ? "—" : `${fmtSigned(v)}%`;
}

function avg(rows: ConceptStock[], key: "d1" | "d5" | "d20" | "d60"): number | null {
  const vals = rows.map((r) => r.returns[key]).filter((v): v is number => v != null);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function qualityTag(s: ConceptStock): string {
  if (s.scoreFund == null) return "品質 —";
  return s.scoreFund >= 70 ? "品質優" : s.scoreFund >= 50 ? "品質普通" : "品質弱";
}

function valTag(s: ConceptStock): string {
  if (s.pe == null) return "估值 —";
  return s.pe <= 15 ? "低估值" : s.pe <= 25 ? "估值合理" : "估值偏高";
}

function instTag(s: ConceptStock): string {
  const f = s.foreign_net_shares > 0;
  const t = s.trust_net_shares > 0;
  if (f && t) return "外資＋投信";
  if (f) return "外資買超";
  if (t) return "投信買超";
  return "法人偏賣";
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [concept, all] = await Promise.all([getConcept(id), getConcepts()]);
  if (!concept) notFound();
  const relatedKeys = [...new Set([...concept.up, ...concept.down])];
  const relatedConcepts = all.filter((c) => relatedKeys.includes(c.key));
  const relatedIds = [...new Set(relatedConcepts.flatMap((c) => c.ids))];
  const [stocks, relatedStocks, indexRet] = await Promise.all([getConceptStocks(concept.ids), getConceptStocks(relatedIds), getIndexReturns()]);
  const date = stocks.find((s) => s.date)?.date ?? "";

  const themeRet = { d1: avg(stocks, "d1"), d5: avg(stocks, "d5"), d20: avg(stocks, "d20"), d60: avg(stocks, "d60") };
  const stockBySid = new Map([...stocks, ...relatedStocks].map((s) => [s.stock_id, s]));
  const graphConcepts: GraphConcept[] = all.map((c) => {
    const list = c.ids.map((sid) => stockBySid.get(sid)).filter(Boolean) as ConceptStock[];
    return { key: c.key, title: c.title, tier: c.tier, up: c.up, down: c.down, avgChg: avg(list, "d1") };
  });

  return (
    <div className="container">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h1 className="page-title">{concept.title}</h1>
          <span className="chip teal">{concept.tier === 0 ? "上游" : concept.tier === 1 ? "中游" : "下游"}</span>
          <span className="chip gold">{stocks.length} 檔成分股</span>
          <span className="chip">資料日期 {date || "—"}</span>
        </div>
        <p className="page-desc" style={{ maxWidth: 760 }}>
          {concept.desc}
        </p>
      </div>

      <div className="section-title">對照大盤表現（近 1 / 5 / 20 / 60 日）</div>
      <div className="summary-cards">
        {(["d1", "d5", "d20", "d60"] as const).map((k) => (
          <div className="summary-card" key={k}>
            <div className="summary-label">{k === "d1" ? "1日" : k === "d5" ? "5日" : k === "d20" ? "20日" : "60日"}</div>
            <div className={`summary-val ${pctClass(themeRet[k])}`}>{ret(themeRet[k])}</div>
            <div className="summary-sub">
              大盤 <span className={pctClass(indexRet[k])}>{ret(indexRet[k])}</span>
              {themeRet[k] != null && indexRet[k] != null && (
                <span className={pctClass(themeRet[k]! - indexRet[k]!)}> ・ 超額 {fmtSigned(themeRet[k]! - indexRet[k]!)}pp</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">成分股</div>
      <div className="concept-grid">
        {stocks.map((s) => (
          <Link key={s.stock_id} href={`/stock/${s.stock_id}`} className="stock-card">
            <div className="card-top">
              <div className="card-title">
                {s.stock_id} {s.name}
              </div>
              <div className={`card-chg ${pctClass(s.change_pct)}`}>{fmtSigned(s.change_pct)}%</div>
            </div>
            <div className="stock-role">{s.role}</div>
            <div className="stock-returns">
              {(["d1", "d5", "d20", "d60"] as const).map((k) => (
                <span key={k} className={pctClass(s.returns[k])}>
                  {k.slice(1)}日 {ret(s.returns[k])}
                </span>
              ))}
            </div>
            <div className="stock-tags">
              <span className="chip gold">{qualityTag(s)}</span>
              <span className="chip teal">{valTag(s)}</span>
              <span className="chip">{instTag(s)}</span>
              <span className="chip">訊號 {s.signals}</span>
            </div>
            <div className="card-bottom">
              <span className="card-count">收盤 {s.close != null ? fmt(s.close, 2) : "—"}</span>
              <span className="card-leader">營收YoY {s.rev_yoy != null ? `${fmtSigned(s.rev_yoy)}%` : "—"}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="section-title">上下游供應鏈</div>
      <ThemeTierGraph concepts={graphConcepts} focusKey={concept.key} />

      <div className="section-title">常見問題</div>
      <div className="card">
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <b style={{ color: "var(--ink)" }}>成分股如何選入？</b> 由站方依產業鏈關係維護（管理頁可編輯），漲跌與報酬即時以收盤資料計算。
          <br />
          <b style={{ color: "var(--ink)" }}>角色標籤怎麼看？</b> 品質＝技術＋基本面評分；估值＝本益比分級；法人＝當日外資/投信淨買超。
          <br />
          <b style={{ color: "var(--ink)" }}>報酬如何計算？</b> 1/5/20/60 日報酬由 stock_prices 收盤價回算，缺歷史資料時顯示「—」。
          <br />
          本站僅整理公開資訊，不構成投資建議，亦非投顧服務。
        </p>
      </div>
    </div>
  );
}
