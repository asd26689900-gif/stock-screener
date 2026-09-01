"use client";

import { useState } from "react";
import Link from "next/link";
import { fmt, fmtSigned, pctClass } from "@/lib/format";
import type { Row } from "@/lib/data";
import SliderTabs from "./SliderTabs";

type Tf = "day" | "week" | "month";

export default function FocusStrong({ data }: { data: Partial<Record<Tf, Row[]>> }) {
  const [tf, setTf] = useState<Tf>("day");
  const rows = data[tf] ?? [];
  return (
    <>
      <SliderTabs<Tf>
        tabs={[
          { key: "day", label: "日" },
          { key: "week", label: "週" },
          { key: "month", label: "月" },
        ]}
        active={tf}
        onChange={setTf}
      />
      {rows.length === 0 ? (
        <div className="empty-msg">本日無符合資料</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>代號</th>
                <th>名稱</th>
                <th className="num">收盤</th>
                <th className="num">漲跌幅</th>
                <th className="num">成交張數</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  <td>
                    <Link href={`/stock/${r[0]}`}>{r[0]}</Link>
                  </td>
                  <td>{r[1]}</td>
                  <td className={`num ${pctClass(Number(r[2]))}`}>{fmt(Number(r[2]), 2)}</td>
                  <td className={`num ${pctClass(Number(r[3]))}`}>{fmtSigned(Number(r[3]))}%</td>
                  <td className="num">{fmt(Number(r[4]), 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
