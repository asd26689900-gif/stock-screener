"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SliderTabs from "./SliderTabs";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

type MarginRow = {
  id: string;
  name: string;
  m_buy: number;
  m_sell: number;
  m_prev: number;
  m_today: number;
  s_buy: number;
  s_sell: number;
  s_prev: number;
  s_today: number;
};

type Tab = "margin_buy" | "margin_sell" | "short_buy" | "short_sell";
const TABS: { key: Tab; label: string }[] = [
  { key: "margin_buy", label: "融資增加" },
  { key: "margin_sell", label: "融資減少" },
  { key: "short_buy", label: "融券增加" },
  { key: "short_sell", label: "融券減少" },
];

export default function MarginView() {
  const [rows, setRows] = useState<MarginRow[]>([]);
  const [date, setDate] = useState("");
  const [tab, setTab] = useState<Tab>("margin_buy");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/twse-proxy?type=margin");
        const j = await r.json();
        if (j.stat !== "OK" || !j.tables) throw new Error("no data");
        if (j.date) {
          const s = String(j.date);
          setDate(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
        }
        const tbl = j.tables.find((t: { data?: unknown[] }) => t.data?.length);
        if (!tbl) throw new Error("no table");
        const p = (s: string) => parseInt((s || "0").replace(/,/g, "").trim(), 10) || 0;
        setRows(
          tbl.data
            .map((row: string[]) => ({
              id: (row[0] || "").trim(),
              name: (row[1] || "").trim(),
              m_buy: p(row[2]),
              m_sell: p(row[3]),
              m_prev: p(row[5]),
              m_today: p(row[6]),
              s_buy: p(row[8]),
              s_sell: p(row[9]),
              s_prev: p(row[11]),
              s_today: p(row[12]),
            }))
            .filter((r: MarginRow) => r.id && r.id.length <= 6 && /^\d/.test(r.id) && r.id !== "合計"),
        );
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mChg = (r: MarginRow) => r.m_today - r.m_prev;
  const sChg = (r: MarginRow) => r.s_today - r.s_prev;
  const sorted =
    tab === "margin_buy"
      ? rows.filter((r) => mChg(r) > 0).sort((a, b) => mChg(b) - mChg(a))
      : tab === "margin_sell"
        ? rows.filter((r) => mChg(r) < 0).sort((a, b) => mChg(a) - mChg(b))
        : tab === "short_buy"
          ? rows.filter((r) => sChg(r) > 0).sort((a, b) => sChg(b) - sChg(a))
          : rows.filter((r) => sChg(r) < 0).sort((a, b) => sChg(a) - sChg(b));
  const isMargin = tab.startsWith("margin");
  const chg = isMargin ? mChg : sChg;

  return (
    <>
      <div className="controls" style={{ marginBottom: 12 }}>
        <SliderTabs<Tab> tabs={TABS} active={tab} onChange={setTab} />
        <span className="date-label">
          資料日期 {date || "—"}（每日 22:00 後更新）
        </span>
      </div>
      {loading ? (
        <div className="sk-box">
          <i />
          <i />
          <i />
        </div>
      ) : error ? (
        <div className="empty-msg">暫無資料，請稍後再試</div>
      ) : (
        <div className="table-wrap" style={{ maxHeight: 560, overflowY: "auto" }}>
          <table>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr>
                <th>代號 / 名稱</th>
                <th className="num">今日餘額</th>
                <th className="num">前日餘額</th>
                <th className="num">增減（張）</th>
                <th className="num">買進</th>
                <th className="num">賣出</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 200).map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/stock/${r.id}`}>{r.id}</Link> {r.name}
                  </td>
                  <td className="num">{fmt(isMargin ? r.m_today : r.s_today, 0)}</td>
                  <td className="num">{fmt(isMargin ? r.m_prev : r.s_prev, 0)}</td>
                  <td className={`num ${pctClass(chg(r))}`}>{fmtSigned(chg(r), 0)}</td>
                  <td className="num">{fmt(isMargin ? r.m_buy : r.s_buy, 0)}</td>
                  <td className="num">{fmt(isMargin ? r.m_sell : r.s_sell, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
