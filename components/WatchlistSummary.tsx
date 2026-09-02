"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authSb, useSession } from "@/lib/auth";
import { fmt, fmtSigned, pctClass } from "@/lib/format";

type Quote = { stock_id: string; name: string; close: number; change_pct: number };

export default function WatchlistSummary() {
  const { user } = useSession();
  const [ids, setIds] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    (async () => {
      let sids: string[] = [];
      if (user && authSb) {
        const { data } = await authSb.from("user_data").select("key,data").eq("user_id", user.id);
        const wl = data?.find((r) => r.key === "watchlists")?.data as Record<string, string[]> | undefined;
        sids = wl ? [...new Set(Object.values(wl).flat())] : [];
      } else {
        try {
          const w = JSON.parse(localStorage.getItem("watchlists") || "null");
          if (w && Object.keys(w).length) sids = [...new Set(Object.values(w as Record<string, string[]>).flat())];
          else {
            const old = JSON.parse(localStorage.getItem("watchlist") || "[]");
            if (Array.isArray(old)) sids = old;
          }
        } catch {}
      }
      setIds(sids);
      if (!sids.length || !authSb) return;
      const { data } = await authSb
        .from("stock_metrics")
        .select("stock_id,name,close,change_pct")
        .in("stock_id", sids);
      setQuotes((data ?? []) as Quote[]);
    })();
  }, [user]);

  if (!ids.length) {
    return (
      <div className="card">
        <div className="section-title" style={{ margin: 0 }}>
          自選股摘要
          <Link href="/watchlist" className="chip gold">前往管理</Link>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>尚無自選股，<Link href="/watchlist" style={{ color: "var(--gold)" }}>點此加入</Link>。</p>
      </div>
    );
  }

  // Sort by absolute change_pct descending (biggest movers first)
  const sorted = [...quotes].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

  return (
    <div className="card">
      <div className="section-title" style={{ margin: "0 0 10px" }}>
        自選股摘要
        <span className="chip teal">{ids.length} 檔</span>
        <Link href="/watchlist" className="chip gold" style={{ marginLeft: "auto" }}>查看全部</Link>
      </div>
      <div className="wl-summary-grid">
        {sorted.slice(0, 12).map((q) => (
          <Link key={q.stock_id} href={`/stock/${q.stock_id}`} className="wl-mini-card">
            <span className="wl-mini-name">{q.name}</span>
            <span className="wl-mini-id">{q.stock_id}</span>
            <span className={`wl-mini-price ${pctClass(q.change_pct)}`}>{fmt(q.close, 2)}</span>
            <span className={`wl-mini-chg ${pctClass(q.change_pct)}`}>{fmtSigned(q.change_pct)}%</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
