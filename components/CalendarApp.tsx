"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SliderTabs from "./SliderTabs";

type CalEvent = { date: string; id: string; name: string; type: "dividend" | "ipo" | "earnings"; label: string; detail: string };

const DOW = ["日", "一", "二", "三", "四", "五", "六"];
const GROUP_CAP = 25;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function rocToAD(s: string): string {
  if (!s) return "";
  const p = s.split("/");
  if (p.length === 3) return `${parseInt(p[0]) + 1911}-${pad(parseInt(p[1]))}-${pad(parseInt(p[2]))}`;
  const m = s.match(/(\d+)年(\d+)月(\d+)日/);
  if (m) return `${parseInt(m[1]) + 1911}-${pad(parseInt(m[2]))}-${pad(parseInt(m[3]))}`;
  return s;
}

const TYPE_LABEL: Record<string, string> = { dividend: "除權息", ipo: "抽籤", earnings: "財報" };

export default function CalendarApp() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [type, setType] = useState<"all" | "dividend" | "ipo" | "earnings">("all");
  const [wlOnly, setWlOnly] = useState(false);
  const [wlIds, setWlIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const events: CalEvent[] = [];
    const months: [number, number][] = [[y, m]];
    const nm = m + 1 > 12 ? [y + 1, 1] : [y, m + 1];
    months.push(nm as [number, number]);
    try {
      const [div1, div2, ipo, tpex, eps] = await Promise.all([
        fetch(`/api/twse-proxy?type=dividend&date=${y - 1911}${pad(m)}`).then((r) => r.json()),
        fetch(`/api/twse-proxy?type=dividend&date=${nm[0] - 1911}${pad(nm[1])}`).then((r) => r.json()),
        fetch("/api/twse-proxy?type=ipo").then((r) => r.json()),
        fetch("/api/twse-proxy?type=tpex_exright").then((r) => r.json()),
        fetch("/api/twse-proxy?type=earnings").then((r) => r.json()),
      ]);
      for (const j of [div1, div2]) {
        for (const row of j?.data ?? []) {
          const dateStr = rocToAD(row[0]);
          const id = String(row[1] || "").trim();
          const name = String(row[2] || "").trim();
          if (!dateStr || !id) continue;
          events.push({ date: dateStr, id, name, type: "dividend", label: String(row[3] || "").includes("息") ? "除息" : "除權", detail: String(row[4] || "").trim() });
        }
      }
      for (const row of ipo?.data ?? []) {
        const drawDate = rocToAD(String(row[1] || ""));
        const startDate = rocToAD(String(row[5] || ""));
        const endDate = rocToAD(String(row[6] || ""));
        const id = String(row[3] || "").trim();
        const name = String(row[2] || "").trim();
        const market = String(row[4] || "").trim();
        const subPrice = String(row[9] || "").trim();
        if (!id) continue;
        if (startDate) events.push({ date: startDate, id, name, type: "ipo", label: market || "抽籤開始", detail: `承銷價 ${subPrice} 元` });
        if (endDate) events.push({ date: endDate, id, name, type: "ipo", label: market || "抽籤截止", detail: `承銷價 ${subPrice} 元` });
        if (drawDate) events.push({ date: drawDate, id, name, type: "ipo", label: market || "抽籤日", detail: `承銷價 ${subPrice} 元` });
      }
      for (const row of Array.isArray(tpex) ? tpex : []) {
        const roc = String(row.ExRrightsExDividendDate || "").trim();
        if (roc.length !== 7) continue;
        const dateStr = `${parseInt(roc.slice(0, 3)) + 1911}-${roc.slice(3, 5)}-${roc.slice(5, 7)}`;
        const id = String(row.SecuritiesCompanyCode || "").trim();
        const name = String(row.CompanyName || "").trim().replace(/股份有限公司$/, "");
        if (!id) continue;
        const cash = parseFloat(row.CashDividend || "0");
        const stock = parseFloat(row.StockDividendRatio || "0");
        const detail = [cash > 0 ? `現金股利 ${cash} 元` : "", stock > 0 ? `股票股利 ${stock}` : ""].filter(Boolean).join(" ・ ");
        events.push({ date: dateStr, id, name, type: "dividend", label: `上櫃${String(row.ExRrightsExDividend || "").includes("權") ? "除權" : "除息"}`, detail });
      }
      for (const row of Array.isArray(eps) ? eps : []) {
        const rocDate = String(row["出表日期"] || "").trim();
        if (rocDate.length !== 7) continue;
        const dateStr = `${parseInt(rocDate.slice(0, 3)) + 1911}-${rocDate.slice(3, 5)}-${rocDate.slice(5, 7)}`;
        const id = String(row["公司代號"] || "").trim();
        if (!id) continue;
        events.push({ date: dateStr, id, name: String(row["公司名稱"] || "").trim().replace(/股份有限公司$/, ""), type: "earnings", label: `Q${row["季別"] || ""} 財報`, detail: row["基本每股盈餘(元)"] ? `EPS ${row["基本每股盈餘(元)"]} 元` : "" });
      }
    } catch {
      // 個別來源失敗不影響其他
    }
    // 法定月營收公告日（每月 10 日，未來 12 個月）
    const t = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(t.getFullYear(), t.getMonth() + i, 10);
      const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const ds = ymd(d);
      if (ds >= todayStr()) events.push({ date: ds, id: "—", name: "全體上市櫃", type: "earnings", label: "月營收公告日", detail: `${prev.getFullYear()}/${pad(prev.getMonth() + 1)} 月營收截止` });
    }
    for (const yy of [t.getFullYear(), t.getFullYear() + 1]) {
      events.push({ date: `${yy}-05-15`, id: "—", name: "全體上市櫃", type: "earnings", label: "Q1 季報截止", detail: `${yy - 1911} 年第一季` });
      events.push({ date: `${yy}-08-14`, id: "—", name: "全體上市櫃", type: "earnings", label: "Q2 季報截止", detail: `${yy - 1911} 年上半年` });
      events.push({ date: `${yy}-11-14`, id: "—", name: "全體上市櫃", type: "earnings", label: "Q3 季報截止", detail: `${yy - 1911} 年第三季` });
      events.push({ date: `${yy}-03-31`, id: "—", name: "全體上市櫃", type: "earnings", label: "年報截止", detail: `${yy - 1912} 年年報` });
    }
    const seen = new Set<string>();
    setEvents(events.filter((e) => {
      const k = `${e.date}|${e.id}|${e.label}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }));
    setLoading(false);
  }, []);

  useEffect(() => {
    load(year, month);
  }, [year, month, load]);

  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem("watchlists") || "null");
      setWlIds(new Set(w ? Object.values(w).flat() as string[] : []));
    } catch {
      setWlIds(new Set());
    }
  }, []);

  const filtered = useMemo(() => {
    return events
      .filter((e) => type === "all" || e.type === type)
      .filter((e) => !wlOnly || wlIds.has(e.id))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }, [events, type, wlOnly, wlIds]);

  const monthEvents = useMemo(() => filtered.filter((e) => e.date.startsWith(`${year}-${pad(month)}`)), [filtered, year, month]);
  const next7 = useMemo(() => {
    const t = new Date();
    return filtered.filter((e) => e.date >= todayStr() && e.date <= ymd(addDays(t, 7)));
  }, [filtered]);

  const grouped = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of filtered) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const first = new Date(year, month - 1, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`)];
  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of monthEvents) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [monthEvents]);

  const move = (d: number) => {
    let m = month + d, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const typeLabel = (e: CalEvent) => e.label || TYPE_LABEL[e.type] || "";
  const typeCls = (e: CalEvent) => (e.type === "dividend" ? "gold" : e.type === "ipo" ? "teal" : "");

  return (
    <>
      <div className="controls" style={{ marginBottom: 12 }}>
        <button type="button" className="btn" onClick={() => move(-1)} aria-label="上一個月">‹</button>
        <span className="date-label">{year} 年 {month} 月</span>
        <button type="button" className="btn" onClick={() => move(1)} aria-label="下一個月">›</button>
        <span className="spacer" style={{ flex: 1 }} />
        <SliderTabs<"all" | "dividend" | "ipo" | "earnings">
          tabs={[
            { key: "all", label: "全部" },
            { key: "dividend", label: "除權息" },
            { key: "ipo", label: "股票抽籤" },
            { key: "earnings", label: "財報" },
          ]}
          active={type}
          onChange={setType}
        />
        <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={wlOnly} onChange={(e) => setWlOnly(e.target.checked)} style={{ accentColor: "var(--gold)" }} /> 只看自選股
        </label>
      </div>
      <div className="summary-cards" style={{ marginBottom: 12 }}>
        <div className="summary-card">
          <div className="summary-label">未來 7 天</div>
          <div className="summary-val">{next7.length} <span className="unit">筆</span></div>
          <div className="summary-sub">除權息 {new Set(next7.filter((e) => e.type === "dividend").map((e) => e.id)).size} 檔 ・ 抽籤 {new Set(next7.filter((e) => e.type === "ipo").map((e) => e.id)).size} 檔</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">本月事件</div>
          <div className="summary-val">{monthEvents.length} <span className="unit">筆</span></div>
          <div className="summary-sub">群組預設顯示上限 {GROUP_CAP} 筆，可展開</div>
        </div>
      </div>
      {loading ? (
        <div className="sk-box"><i /><i /><i /><i /><i /></div>
      ) : (
        <>
          <div className="cal-grid">
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((ds, i) =>
              ds ? (
                <div key={i} className={`cal-day${ds === todayStr() ? " today" : ""}${byDate.has(ds) ? " has-events" : ""}`}>
                  <div className="cal-num">{Number(ds.slice(8))}</div>
                  {byDate.has(ds) && <div className="hc-count">{byDate.get(ds)!.length}</div>}
                </div>
              ) : (
                <div key={i} className="cal-day empty" />
              ),
            )}
          </div>
          <div className="section-title">事件列表</div>
          {grouped.length === 0 ? (
            <div className="empty-msg">此月份無事件</div>
          ) : (
            grouped.map(([date, list]) => {
              const isExpanded = expanded.has(date);
              const shown = isExpanded ? list : list.slice(0, GROUP_CAP);
              return (
                <div key={date} className="card" style={{ padding: 12, marginBottom: 10 }}>
                  <div className="mega-col-title">{date}（{DOW[new Date(date).getDay()]}）・ {list.length} 筆</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {shown.map((e, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span className={`chip ${typeCls(e)}`}>{typeLabel(e)}</span>
                        {e.id !== "—" ? (
                          <Link href={`/stock/${e.id}`}><b>{e.id}</b> {e.name}</Link>
                        ) : (
                          <b>{e.name}</b>
                        )}
                        <span className="hint" style={{ marginLeft: "auto" }}>{e.detail}</span>
                      </div>
                    ))}
                  </div>
                  {list.length > GROUP_CAP && (
                    <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => setExpanded((prev) => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; })}>
                      {isExpanded ? "收合" : `展開全部 ${list.length} 筆`}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </>
  );
}
