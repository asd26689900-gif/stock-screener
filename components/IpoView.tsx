"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/format";

type IpoRow = {
  id: string;
  name: string;
  market: string;
  subPrice: number | null;
  drawDate: string;
  startDate: string;
  endDate: string;
  settleDate: string;
  rate: string;
  cancelled: string;
};

function rocToAD(s: string): string {
  if (!s) return "";
  const p = s.split("/");
  if (p.length !== 3) return s;
  return `${parseInt(p[0]) + 1911}/${p[1]}/${p[2]}`;
}

export default function IpoView() {
  const [rows, setRows] = useState<IpoRow[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/twse-proxy?type=ipo");
        const j = await r.json();
        if (!j.data?.length) {
          setRows([]);
          return;
        }
        setRows(
          j.data
            .map((row: string[]) => {
              const id = (row[3] || "").trim();
              const subPriceTxt = (row[9] || "").trim().replace(/,/g, "");
              const subPrice = parseFloat(subPriceTxt);
              return {
                id,
                name: (row[2] || "").trim(),
                market: (row[4] || "").trim(),
                subPrice: Number.isFinite(subPrice) ? subPrice : null,
                drawDate: rocToAD(row[1] || ""),
                startDate: rocToAD(row[5] || ""),
                endDate: rocToAD(row[6] || ""),
                settleDate: rocToAD(row[11] || ""),
                rate: (row[16] || "").trim(),
                cancelled: (row[17] || "").trim(),
              };
            })
            .filter((c: IpoRow) => c.id && !/^A/i.test(c.id))
            .sort((a: IpoRow, b: IpoRow) => (b.drawDate || "").localeCompare(a.drawDate || "")),
        );
      } catch {
        setRows([]);
      }
    })();
  }, []);

  if (rows === null) {
    return (
      <div className="sk-box">
        <i /><i /><i />
      </div>
    );
  }
  return (
    <div className="module">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>代號</th><th>名稱</th><th className="num">承銷價</th><th>申購期間</th><th>抽籤日期</th><th>撥券日期</th><th className="num">中籤率</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-row" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>
                  目前無公開申購資訊
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id + c.drawDate} className={c.cancelled ? "ipo-cancelled" : ""}>
                  <td>{c.id}</td>
                  <td>
                    {c.name}
                    {c.market ? <span className="chip" style={{ marginLeft: 6 }}>{c.market}</span> : null}
                    {c.cancelled ? <span className="badge red" style={{ marginLeft: 6 }}>{c.cancelled}</span> : null}
                  </td>
                  <td className="num">{c.subPrice != null ? `${fmt(c.subPrice, 2)} 元` : "—"}</td>
                  <td>{c.startDate} ~ {c.endDate}</td>
                  <td>{c.drawDate}</td>
                  <td>{c.settleDate}</td>
                  <td className="num">{c.rate || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
