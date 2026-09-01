import type { Metadata } from "next";
import Link from "next/link";
import { getLatestExecutionTimes, getLatestFocus, type FocusData, type Row } from "@/lib/data";
import { fmt, fmtSigned, pctClass } from "@/lib/format";
import UpdateStamp from "@/components/UpdateStamp";

export const metadata: Metadata = { title: "ETF 總覽" };
export const dynamic = "force-dynamic";

function EtfTable({ rows, label }: { rows: Row[]; label: string }) {
  if (!rows?.length) return <div className="empty-msg">無資料</div>;
  return (
    <div className="table-wrap" style={{ maxHeight: 460, overflowY: "auto" }}>
      <table>
        <thead style={{ position: "sticky", top: 0 }}>
          <tr>
            <th>代號</th>
            <th>名稱</th>
            <th className="num">收盤</th>
            <th className="num">漲跌%</th>
            <th className="num">成交張</th>
            <th className="num">成交額（億）</th>
            <th className="num">法人買賣超（張）</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              <td>
                <Link href={`/stock/${r[0]}`}>{r[0]}</Link>
              </td>
              <td>
                {r[1]}
                {r[7] ? <span className="etf-tag">主動</span> : null}
              </td>
              <td className="num">{fmt(Number(r[2]), 2)}</td>
              <td className={`num ${pctClass(Number(r[3]))}`}>{fmtSigned(Number(r[3]))}%</td>
              <td className="num">{fmt(Number(r[4]), 0)}</td>
              <td className="num">{fmt(Number(r[5]), 2)}</td>
              <td className={`num ${pctClass(Number(r[6]))}`}>{fmtSigned(Number(r[6]), 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint" style={{ padding: "8px 12px" }}>
        {label}
      </p>
    </div>
  );
}

export default async function Page() {
  const [focus, times] = await Promise.all([getLatestFocus(), getLatestExecutionTimes()]);
  const etf = (focus?.data as FocusData)?.etf;
  const all = etf?.all ?? [];
  const active = all.filter((r) => r[7]);
  const rest = all.filter((r) => !r[7]).sort((a, b) => Number(b[5]) - Number(a[5]));
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">ETF 總覽</h1>
        <p className="page-desc">含主動式 ETF 買賣統計追蹤（代號尾碼 A / D）。</p>
      </div>
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">ETF 檔數</div>
          <div className="summary-val">
            {all.length} <span className="unit">檔</span>
          </div>
          <div className="summary-sub">{focus?.date ?? "—"}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">主動式 ETF</div>
          <div className="summary-val">
            {active.length} <span className="unit">檔</span>
          </div>
          <div className="summary-sub">代號尾碼 A / D</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">成交額最大</div>
          <div className="summary-val" style={{ fontSize: 16 }}>
            {all[0]?.[1] ?? "—"}
          </div>
          <div className="summary-sub">{all[0] ? `${fmt(Number(all[0][5]), 2)} 億` : "—"}</div>
        </div>
      </div>
      <div className="section-title">
        主動式 ETF
        <UpdateStamp job="update" times={times} label="行情" />
      </div>
      <EtfTable rows={active.slice(0, 30)} label="主動式 ETF（經理人主動選股/選債），代號尾碼 A / D" />
      <div className="section-title">全部 ETF（成交額前 40）</div>
      <EtfTable rows={rest.slice(0, 40)} label="不含主動式，依成交額排序" />
    </div>
  );
}
