"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import type { InstMetrics } from "@/lib/data";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

const INST_LABELS = ["外資（含自營）", "投信", "自營商"] as const;
const NET_KEYS = ["foreign_net_shares", "trust_net_shares", "dealer_net_shares"] as const;
const CONSEC_KEYS = ["foreign_consec_days", "trust_consec_days", "dealer_consec_days"] as const;

export default function InstitutionalView() {
  const [rows, setRows] = useState<InstMetrics[]>([]);
  const [inst, setInst] = useState(0);
  const [market, setMarket] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!sb) return;
      const all: InstMetrics[] = [];
      try {
        for (let page = 0; page < 10; page++) {
          const { data } = await sb
            .from("stock_metrics")
            .select(
              "stock_id,name,date,close,change_pct,volume,foreign_net_shares,foreign_consec_days,trust_net_shares,trust_consec_days,dealer_net_shares,dealer_consec_days,market_type,industry",
            )
            .order("stock_id")
            .range(page * 1000, (page + 1) * 1000 - 1);
          if (!data?.length) break;
          all.push(...(data as InstMetrics[]));
          if (data.length < 1000) break;
        }
      } catch {
        // 保留已取得的資料
      } finally {
        setRows(all);
        setLoading(false);
      }
    })();
  }, []);

  const industries = useMemo(() => [...new Set(rows.map((r) => r.industry).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (market !== "all" && (r.market_type || "twse") !== market) return false;
      if (industry !== "all" && r.industry !== industry) return false;
      return true;
    });
  }, [rows, market, industry]);

  const net = (r: InstMetrics) => Number(r[NET_KEYS[inst]]) || 0;
  const consec = (r: InstMetrics) => Number(r[CONSEC_KEYS[inst]]) || 0;
  const buyers = filtered.filter((r) => net(r) > 0).sort((a, b) => net(b) - net(a));
  const sellers = filtered.filter((r) => net(r) < 0).sort((a, b) => net(a) - net(b));
  const bothBuy = filtered.filter((r) => (r.foreign_net_shares || 0) > 0 && (r.trust_net_shares || 0) > 0).length;

  const Table = ({ list, title }: { list: InstMetrics[]; title: string }) => (
    <div className="card" style={{ padding: 12 }}>
      <div className="section-title" style={{ marginTop: 0, marginBottom: 8 }}>
        {title}
        <span className="badge-count">{list.length} 檔</span>
      </div>
      <div className="table-wrap" style={{ maxHeight: 460, overflowY: "auto" }}>
        <table style={{ fontSize: 12.5 }}>
          <thead style={{ position: "sticky", top: 0 }}>
            <tr>
              <th>代號 / 名稱</th>
              <th className="num">收盤</th>
              <th className="num">漲跌%</th>
              <th className="num">淨買賣超（張）</th>
              <th className="num">連買/賣天數</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 100).map((r) => (
              <tr key={r.stock_id}>
                <td>
                  <Link href={`/stock/${r.stock_id}`}>{r.stock_id}</Link> {r.name}
                </td>
                <td className="num">{fmt(r.close, 2)}</td>
                <td className={`num ${pctClass(r.change_pct)}`}>{fmtSigned(r.change_pct)}%</td>
                <td className={`num ${pctClass(net(r))}`}>{fmtSigned(net(r) / 1000, 0)}</td>
                <td className="num">{consec(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {loading && (
        <div className="sk-box" style={{ marginBottom: 12 }}>
          <i />
          <i />
          <i />
        </div>
      )}
      {!loading && rows.length === 0 && <div className="empty-msg" style={{ marginBottom: 12 }}>尚無資料</div>}
      <div className="summary-cards" style={{ marginBottom: 12 }}>
        <div className="summary-card">
          <div className="summary-label">{INST_LABELS[inst]} 買超 Top1</div>
          <div className="summary-val" style={{ fontSize: 15 }}>
            {buyers[0] ? `${buyers[0].stock_id} ${buyers[0].name}` : "—"}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">{INST_LABELS[inst]} 賣超 Top1</div>
          <div className="summary-val" style={{ fontSize: 15 }}>
            {sellers[0] ? `${sellers[0].stock_id} ${sellers[0].name}` : "—"}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">外資＋投信同買</div>
          <div className="summary-val">{bothBuy} 檔</div>
        </div>
      </div>
      <div className="controls" style={{ marginBottom: 14 }}>
        <div className="tab-bar">
          {INST_LABELS.map((label, i) => (
            <button key={label} type="button" className={`tab-btn ${inst === i ? "active" : ""}`} onClick={() => setInst(i)}>
              {label}
            </button>
          ))}
        </div>
        <select value={market} onChange={(e) => setMarket(e.target.value)} aria-label="市場">
          <option value="all">全部市場</option>
          <option value="twse">上市</option>
          <option value="tpex">上櫃</option>
        </select>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="產業">
          <option value="all">全部產業</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 12 }}>
        <Table list={buyers} title="買超排行" />
        <Table list={sellers} title="賣超排行" />
      </div>
    </>
  );
}
