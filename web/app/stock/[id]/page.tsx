import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStockPage, resolveStock } from "@/lib/stock";
import { getLatestExecutionTimes } from "@/lib/data";
import { fmt, fmtSigned, pctClass } from "@/lib/format";
import { stockIntro } from "@/lib/intro";
import KChart, { type InstByDate } from "@/components/KChart";
import InstitutionalPanel from "@/components/InstitutionalPanel";
import HolderSlider from "@/components/HolderSlider";
import UpdateStamp from "@/components/UpdateStamp";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `個股分析 ${id}` };
}

function QuoteCard({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="summary-card">
      <div className="summary-label">{label}</div>
      <div className={`summary-val ${cls ?? ""}`}>{value}</div>
      {sub && <div className="summary-sub">{sub}</div>}
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveStock(id);
  const sid = resolved?.stock_id ?? id;
  const [data, times] = await Promise.all([getStockPage(sid), getLatestExecutionTimes()]);
  if (!data) notFound();

  const q = data.quote;
  const last = data.bars[data.bars.length - 1];
  const instByDate: InstByDate = {};
  data.instRows.forEach((r) => {
    instByDate[r.date] = [
      Math.round((r.foreign_net ?? 0) / 1000),
      Math.round((r.trust_net ?? 0) / 1000),
      Math.round((r.dealer_net ?? 0) / 1000),
    ];
  });
  const intro = stockIntro(sid, data.name, data.industry);
  const rev = data.revenue ?? [];
  const maxRev = Math.max(...rev.map((r) => Number(r.rev) || 0), 1);

  return (
    <div className="container">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 className="page-title">
            {data.name} <span className="hint" style={{ fontSize: 14 }}>{sid}</span>
          </h1>
          {data.industry && <span className="chip teal">{data.industry}</span>}
          {data.scores &&
            Object.entries(data.scores).map(([k, v]) => (
              <span key={k} className="chip gold">
                {k === "chip" ? "籌碼" : k === "fundamental" ? "基本面" : "技術"} {fmt(Number(v), 0)}
              </span>
            ))}
        </div>
        <p className="page-desc" style={{ maxWidth: 760 }}>
          {intro}
        </p>
      </div>

      <div className="section-title" style={{ marginTop: 0 }}>
        報價 / K 線
        <UpdateStamp job="update" times={times} label="行情" />
      </div>
      <KChart bars={data.bars} instByDate={instByDate} />

      <div className="section-title">
        即時報價
        <span className="hint">Yahoo Finance 延遲約 15 分</span>
      </div>
      <div className="summary-cards">
        <QuoteCard label="收盤" value={fmt(q.close, 2)} sub={q.date} cls={pctClass(q.changePct)} />
        <QuoteCard label="漲跌" value={fmtSigned(q.change, 2)} sub={`${fmtSigned(q.changePct)}%`} cls={pctClass(q.changePct)} />
        <QuoteCard label="成交量" value={`${fmt(q.volume, 0)} 張`} />
        {last && (
          <>
            <QuoteCard label="開" value={fmt(last.o, 2)} />
            <QuoteCard label="高" value={fmt(last.h, 2)} cls="up" />
            <QuoteCard label="低" value={fmt(last.l, 2)} cls="down" />
          </>
        )}
        {[["MA5", q.ma5], ["MA10", q.ma10], ["MA20", q.ma20], ["MA60", q.ma60]].map(([label, v]) => (
          <QuoteCard key={label as string} label={label as string} value={v != null ? fmt(Number(v), 2) : "—"} />
        ))}
        <QuoteCard label="本益比" value={q.pe != null ? fmt(q.pe, 2) : "—"} />
        <QuoteCard label="股價淨值比" value={q.pb != null ? fmt(q.pb, 2) : "—"} />
        <QuoteCard label="殖利率" value={q.dy != null ? `${fmt(q.dy, 2)}%` : "—"} />
        <QuoteCard label="營收 MoM" value={q.revMom != null ? `${fmtSigned(q.revMom)}%` : "—"} cls={pctClass(q.revMom)} />
        <QuoteCard label="營收 YoY" value={q.revYoy != null ? `${fmtSigned(q.revYoy)}%` : "—"} cls={pctClass(q.revYoy)} />
      </div>

      <div className="section-title">
        法人累計 / 當日
        <UpdateStamp job="update" times={times} label="法人" />
      </div>
      <InstitutionalPanel rows={data.instRows} />

      <HolderSlider bigPct={data.chip?.bigHolderPct} retailPct={data.chip?.retailHolderPct} src={data.chip?.holderSrc} levels={data.chip?.tdccLevels} />

      <div className="section-title">
        基本面 / 月營收 / 本益比河流圖
        <span className="hint">PE / PB / 殖利率為最新快照</span>
      </div>
      <div className="card">
        <div className="summary-cards" style={{ marginBottom: 16 }}>
          <QuoteCard label="本益比" value={q.pe != null ? fmt(q.pe, 2) : "—"} />
          <QuoteCard label="股價淨值比" value={q.pb != null ? fmt(q.pb, 2) : "—"} />
          <QuoteCard label="殖利率" value={q.dy != null ? `${fmt(q.dy, 2)}%` : "—"} />
        </div>
        {rev.length > 0 ? (
          <>
            <div className="mega-col-title">月營收（近 12 個月，單位：千元）</div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 6,
                height: 150,
                borderBottom: "1px solid var(--border)",
                padding: "8px 4px 0",
                overflowX: "auto",
              }}
            >
              {rev.map((r) => (
                <div key={r.m} style={{ flex: "1 0 44px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span className="hint" style={{ fontSize: 10 }}>
                    {r.mom != null ? `${fmtSigned(r.mom, 0)}%` : "—"}
                  </span>
                  <div
                    title={`${r.m} 營收 ${fmt(Number(r.rev), 0)}`}
                    style={{
                      width: "100%",
                      height: Math.max(4, (Number(r.rev) / maxRev) * 100),
                      background: Number(r.yoy) >= 0 ? "var(--gold)" : "var(--teal)",
                      opacity: 0.85,
                      borderRadius: 3,
                      minWidth: 24,
                    }}
                  />
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>{r.m.slice(5)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-msg">月營收資料待回填（FinMind / histock）</div>
        )}
        <div className="section-title" style={{ marginTop: 18 }}>
          本益比河流圖
          <span className="hint">歷史 PE 序列需回補後繪製（第 4 批）</span>
        </div>
        <div className="empty-msg">將以歷史 PE ± 1σ 畫河流帶，與月營收同區塊顯示。</div>
      </div>
    </div>
  );
}
