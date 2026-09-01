import Link from "next/link";
import type { Row } from "@/lib/data";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

function isPctCol(col: string): boolean {
  return /MOM|YOY|乖離|殖利率|漲跌/.test(col);
}

export default function RowTable({
  rows,
  cols,
  emptyText = "今日無符合標的",
  star,
}: {
  rows: Row[];
  cols: string[];
  emptyText?: string;
  star?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
            {star && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length + (star ? 1 : 0)} className="empty-row" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r[0]}>
                {r.map((v, i) => {
                  if (i <= 1) {
                    return i === 0 ? (
                      <td key={i}>
                        <Link href={`/stock/${r[0]}`}>{r[0]}</Link>
                      </td>
                    ) : (
                      <td key={i}>{v}</td>
                    );
                  }
                  const num = Number(v);
                  const col = cols[i] ?? "";
                  const cls = isPctCol(col) ? pctClass(num) : "";
                  return (
                    <td key={i} className={`num ${cls}`}>
                      {isPctCol(col) ? `${fmtSigned(num)}%` : fmt(num, num % 1 !== 0 ? 2 : 0)}
                    </td>
                  );
                })}
                {star && (
                  <td>
                    <Link href={`/stock/${r[0]}`} className="hint">
                      分析 →
                    </Link>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
