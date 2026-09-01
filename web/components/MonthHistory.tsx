"use client";

import { useCallback, useEffect, useState } from "react";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

type DayRow = { date: string; index: number; chg_pt: number; volume: number; amount: number };

export default function MonthHistory() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setEmpty(false);
    const ym = `${y}${String(m).padStart(2, "0")}`;
    try {
      const r = await fetch(`/api/twse-proxy?type=index_daily&date=${ym}`);
      const j = await r.json();
      if (j.stat !== "OK" || !j.data?.length) {
        setRows([]);
        setEmpty(true);
        return;
      }
      setRows(
        j.data.map((row: string[]) => {
          const dp = (row[0] || "").split("/");
          const dateStr = dp.length === 3 ? `${parseInt(dp[0]) + 1911}/${dp[1]}/${dp[2]}` : row[0];
          return {
            date: dateStr,
            index: parseFloat((row[4] || "0").replace(/,/g, "")) || 0,
            chg_pt: parseFloat((row[5] || "0").replace(/,/g, "")) || 0,
            volume: parseFloat((row[1] || "0").replace(/,/g, "")) || 0,
            amount: parseFloat((row[2] || "0").replace(/,/g, "")) || 0,
          };
        }),
      );
    } catch {
      setRows([]);
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year, month);
  }, [year, month, load]);

  const move = (d: number) => {
    let m = month + d, y = year;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (m < 1) {
      m = 12;
      y--;
    }
    setMonth(m);
    setYear(y);
  };

  const upDays = rows.filter((r) => r.chg_pt > 0).length;
  const dnDays = rows.filter((r) => r.chg_pt < 0).length;
  const totalChg = rows.reduce((s, r) => s + r.chg_pt, 0);
  const maxUp = rows.reduce((m, r) => (r.chg_pt > m.chg_pt ? r : m), rows[0]);
  const maxDn = rows.reduce((m, r) => (r.chg_pt < m.chg_pt ? r : m), rows[0]);

  return (
    <>
      <div className="controls" style={{ marginBottom: 12 }}>
        <button type="button" className="btn" onClick={() => move(-1)} aria-label="上一個月">
          ‹
        </button>
        <span className="date-label">
          {year} 年 {month} 月
        </span>
        <button type="button" className="btn" onClick={() => move(1)} aria-label="下一個月">
          ›
        </button>
      </div>
      {loading ? (
        <div className="sk-box">
          <i />
          <i />
          <i />
        </div>
      ) : empty ? (
        <div className="empty-msg">此月份無資料</div>
      ) : (
        <>
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-label">交易日</div>
              <div className="summary-val">
                {rows.length} <span className="unit">天</span>
              </div>
              <div className="summary-sub">
                上漲 {upDays} / 下跌 {dnDays}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">月漲跌</div>
              <div className={`summary-val ${pctClass(totalChg)}`}>{fmtSigned(totalChg, 0)} 點</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">最大漲幅日</div>
              <div className="summary-val up">+{fmt(maxUp?.chg_pt ?? 0, 0)}</div>
              <div className="summary-sub">{maxUp?.date ?? "—"}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">最大跌幅日</div>
              <div className="summary-val down">{fmt(maxDn?.chg_pt ?? 0, 0)}</div>
              <div className="summary-sub">{maxDn?.date ?? "—"}</div>
            </div>
          </div>
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: "auto" }}>
            <table>
              <thead style={{ position: "sticky", top: 0 }}>
                <tr>
                  <th>日期</th>
                  <th className="num">加權指數</th>
                  <th className="num">漲跌點數</th>
                  <th className="num">成交金額（億）</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td className="num">{fmt(r.index, 2)}</td>
                    <td className={`num ${pctClass(r.chg_pt)}`}>{fmtSigned(r.chg_pt, 0)}</td>
                    <td className="num">{fmt(Math.round(r.amount / 1e8), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
