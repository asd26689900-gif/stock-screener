import Link from "next/link";
import type { Metadata } from "next";
import { getLatestExecutionTimes, getLatestFocus, type FocusData, type Row, type MarginRow } from "@/lib/data";
import { fmt, fmtSigned, pctClass } from "@/lib/format";
import UpdateStamp from "@/components/UpdateStamp";
import FocusStrong from "@/components/FocusStrong";

export const metadata: Metadata = { title: "市場總覽" };
export const dynamic = "force-dynamic";

function StockLink({ sid, name }: { sid: string; name: string }) {
  return (
    <td>
      <Link href={`/stock/${sid}`}>{sid}</Link> {name}
    </td>
  );
}

function MiniTable({
  title,
  rows,
  cols,
}: {
  title: string;
  rows: Row[];
  cols: { key: string; label: string; num?: boolean; fmt?: (v: number) => string }[];
}) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="mega-col-title">{title}</div>
      {rows.length === 0 ? (
        <div className="empty-msg" style={{ padding: 10 }}>
          無資料
        </div>
      ) : (
        <div className="table-wrap" style={{ border: 0 }}>
          <table style={{ fontSize: 12.5 }}>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  <td style={{ padding: "5px 6px" }}>
                    <Link href={`/stock/${r[0]}`}>{r[0]}</Link>
                  </td>
                  <td style={{ padding: "5px 6px" }}>{r[1]}</td>
                  {cols.map((c, i) => (
                    <td key={c.key} className={`num ${c.key.startsWith("pct") ? pctClass(Number(r[i + 2])) : ""}`} style={{ padding: "5px 6px" }}>
                      {c.fmt ? c.fmt(Number(r[i + 2])) : fmt(r[i + 2], 2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const marginToRow = (rows: MarginRow[] | undefined): Row[] =>
  (rows ?? []).map((r) => [r.id, r.name, r.m_today - r.m_prev, 0, 0] as Row);

export default async function Home() {
  const [times, focus] = await Promise.all([getLatestExecutionTimes(), getLatestFocus()]);
  const d: FocusData = focus?.data ?? {};
  const strong = d.strong ?? {};

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">市場總覽</h1>
        <p className="page-desc">
          大盤走勢、每日焦點與新聞晨報，每日盤後自動更新。
          <span className="hint" style={{ marginLeft: 8 }}>
            （Phase 1 骨架已接真實資料，K線與完整模組陸續搬遷）
          </span>
        </p>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>
          大盤走勢
          <UpdateStamp job="update" times={times} />
        </div>
        <div className="empty-msg">K 線圖將於第 2 批（個股 + 大盤 K 線）上線，沿用 lightweight-charts v4 引擎。</div>
      </div>

      <div className="section-title">
        本週強勢股
        <UpdateStamp job="update" times={times} label="行情" />
      </div>
      <FocusStrong data={{ day: strong.day ?? [], week: strong.week ?? [], month: strong.month ?? [] }} />

      <div className="section-title">
        大戶加碼股
        <UpdateStamp job="update" times={times} label="集保" />
      </div>
      {d.big_buyer && d.big_buyer.rows && d.big_buyer.rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>代號 / 名稱</th>
                <th className="num">三大法人淨買超（張）</th>
                <th className="num">連續買超天數</th>
                <th className="num">收盤</th>
              </tr>
            </thead>
            <tbody>
              {d.big_buyer.rows.slice(0, 15).map((r) => (
                <tr key={r[0]}>
                  <StockLink sid={r[0]} name={r[1]} />
                  <td className="num up">{fmt(r[2], 0)}</td>
                  <td className="num">{r[3]}</td>
                  <td className="num">{fmt(r[4], 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-msg">本週尚無集保快照（週六 06:30 更新）</div>
      )}

      <div className="section-title">
        三大法人動向
        <UpdateStamp job="update" times={times} label="法人" />
      </div>
      <div className="summary-cards" style={{ marginBottom: 10 }}>
        <div className="summary-card">
          <div className="summary-label">法人同時買超家數</div>
          <div className="summary-val">{d.institutional?.both_buy ?? "—"}</div>
          <div className="summary-sub">外資＋投信同買</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
        <MiniTable title="外資買超 Top" rows={d.institutional?.foreign_top ?? []} cols={[{ key: "f", label: "外資淨買超", num: true, fmt: (v) => fmt(v / 1000, 0) }]} />
        <MiniTable title="投信買超 Top" rows={d.institutional?.trust_top ?? []} cols={[{ key: "t", label: "投信淨買超", num: true, fmt: (v) => fmt(v / 1000, 0) }]} />
        <MiniTable title="自營買超 Top" rows={d.institutional?.dealer_top ?? []} cols={[{ key: "d", label: "自營淨買超", num: true, fmt: (v) => fmt(v / 1000, 0) }]} />
      </div>

      <div className="section-title">
        ETF 動向
        <span className="chip teal">主動式 {d.etf?.active_count ?? 0} 檔</span>
        <UpdateStamp job="update" times={times} label="行情" />
      </div>
      {d.etf && d.etf.top_amount && d.etf.top_amount.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>代號 / 名稱</th>
                <th className="num">收盤</th>
                <th className="num">漲跌幅</th>
                <th className="num">成交張數</th>
                <th className="num">成交金額（億）</th>
                <th className="num">法人淨買超（張）</th>
              </tr>
            </thead>
            <tbody>
              {d.etf.top_amount.slice(0, 10).map((r) => (
                <tr key={r[0]}>
                  <StockLink sid={r[0]} name={r[1]} />
                  <td className={`num ${pctClass(r[3])}`}>{fmt(r[2], 2)}</td>
                  <td className={`num ${pctClass(r[3])}`}>{fmtSigned(r[3])}%</td>
                  <td className="num">{fmt(r[4], 0)}</td>
                  <td className="num">{fmt(r[5], 2)}</td>
                  <td className="num">{fmt(r[6], 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-msg">無 ETF 資料</div>
      )}

      <div className="section-title">
        資券變化
        <UpdateStamp job="update" times={times} label="資券" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
        <MiniTable title="融資增加 Top" rows={marginToRow(d.margin?.m_up)} cols={[{ key: "m", label: "融資增減（張）", num: true, fmt: (v) => fmt(v, 0) }]} />
        <MiniTable title="融券增加 Top" rows={marginToRow(d.margin?.s_up)} cols={[{ key: "s", label: "融券增減（張）", num: true, fmt: (v) => fmt(v, 0) }]} />
      </div>
    </div>
  );
}
