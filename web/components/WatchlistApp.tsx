"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authSb, useSession } from "@/lib/auth";
import { fmt, fmtSigned, pctClass } from "@/lib/format";
import { computeCurve, computePosition, newTx, type Tx } from "@/lib/ledger";

type Quote = {
  stock_id: string;
  name: string;
  close: number;
  change_pct: number;
  volume: number;
  rev_yoy: number | null;
  rev_mom: number | null;
  date: string | null;
};
type MopsItem = { id: string; company: string; title: string; cat: string; time: string; url: string };

const WL_KEY = "watchlists";
const TX_KEY = "holdings";

export default function WatchlistApp() {
  const { user } = useSession();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"quote" | "holdings">("quote");
  const [lists, setLists] = useState<Record<string, string[]>>({ 我的自選: [] });
  const [active, setActive] = useState("我的自選");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [mops, setMops] = useState<MopsItem[]>([]);
  const [addInput, setAddInput] = useState("");
  const [newList, setNewList] = useState("");
  const [editTx, setEditTx] = useState<Tx | null>(null);
  const [txForm, setTxForm] = useState<Tx>(newTx(""));

  const persist = useCallback(
    async (key: string, value: unknown) => {
      if (user) {
        await authSb
          ?.from("user_data")
          .upsert({ user_id: user.id, key, data: value, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
      } else {
        try {
          localStorage.setItem(key === WL_KEY ? WL_KEY : TX_KEY, JSON.stringify(value));
        } catch {}
      }
    },
    [user],
  );

  const loadUserData = useCallback(async () => {
    if (!user || !authSb) return;
    const { data } = await authSb.from("user_data").select("key,data").eq("user_id", user.id);
    for (const r of data ?? []) {
      if (r.key === WL_KEY) setLists((r.data as Record<string, string[]>) ?? { 我的自選: [] });
      if (r.key === TX_KEY) setTxs((r.data as Tx[]) ?? []);
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      if (user) {
        await loadUserData();
      } else {
        try {
          const w = JSON.parse(localStorage.getItem(WL_KEY) || "null");
          if (w && Object.keys(w).length) setLists(w);
          else {
            const old = JSON.parse(localStorage.getItem("watchlist") || "[]");
            if (old.length) setLists({ 我的自選: old });
          }
          const t = JSON.parse(localStorage.getItem(TX_KEY) || "null");
          if (Array.isArray(t)) setTxs(t);
        } catch {}
      }
      setReady(true);
    })();
  }, [user, loadUserData]);

  // 抓自選報價與重大消息
  useEffect(() => {
    (async () => {
      const ids = [...new Set(Object.values(lists).flat())];
      if (!ids.length) {
        setQuotes({});
        return;
      }
      if (!authSb) return;
      const { data } = await authSb
        .from("stock_metrics")
        .select("stock_id,name,close,change_pct,volume,rev_yoy,rev_mom,date")
        .in("stock_id", ids);
      const m: Record<string, Quote> = {};
      for (const r of data ?? []) m[r.stock_id] = r as Quote;
      setQuotes(m);
      const { data: mopsData } = await authSb.from("daily_mops").select("date,data").order("date", { ascending: false }).limit(1);
      const list = (mopsData?.[0]?.data as { list?: MopsItem[] })?.list ?? [];
      setMops(list);
    })();
  }, [lists, user]);

  const activeIds = lists[active] ?? [];
  const signalsFor = (sid: string, name: string) => {
    const news = mops.filter((m) => m.id === sid || (name && m.company?.includes(name))).length;
    const q = quotes[sid];
    const rev = q?.rev_yoy != null && q?.rev_mom != null;
    return { news, rev };
  };

  const addStock = async () => {
    const v = addInput.trim();
    if (!v || !authSb) return;
    const isId = /^\d{4,6}$/.test(v);
    const { data } = isId
      ? await authSb.from("stock_metrics").select("stock_id").eq("stock_id", v).limit(1)
      : await authSb.from("stock_metrics").select("stock_id").ilike("name", `%${v}%`).limit(1);
    const sid = data?.[0]?.stock_id;
    if (!sid) return;
    const next = { ...lists, [active]: [...new Set([...(lists[active] ?? []), sid])] };
    setLists(next);
    await persist(WL_KEY, next);
    setAddInput("");
  };

  const removeStock = async (sid: string) => {
    const next = { ...lists, [active]: (lists[active] ?? []).filter((x) => x !== sid) };
    setLists(next);
    await persist(WL_KEY, next);
  };

  const createList = async () => {
    const name = newList.trim();
    if (!name || lists[name]) return;
    const next = { ...lists, [name]: [] };
    setLists(next);
    setActive(name);
    setNewList("");
    await persist(WL_KEY, next);
  };

  const saveTx = async () => {
    if (!editTx?.sid || !txForm.sid || txForm.shares <= 0 || txForm.price <= 0) return;
    const others = txs.filter((t) => t.id !== txForm.id);
    const next = [...others, { ...txForm, id: txForm.id || newTx(txForm.sid).id }];
    setTxs(next);
    await persist(TX_KEY, next);
    setEditTx(null);
    setTxForm(newTx(""));
  };

  const deleteTx = async (id: string) => {
    const next = txs.filter((t) => t.id !== id);
    setTxs(next);
    await persist(TX_KEY, next);
  };

  const holdings = useMemo(() => {
    const sids = [...new Set(txs.map((t) => t.sid))];
    return sids
      .map((sid) => {
        const stockTxs = txs.filter((t) => t.sid === sid);
        const pos = computePosition(stockTxs, quotes[sid]?.close ?? null);
        return { sid, name: quotes[sid]?.name ?? sid, pos, curve: computeCurve(stockTxs, quotes[sid]?.close ?? null) };
      })
      .filter((h) => h.pos && (h.pos.shares > 0 || h.pos.realized !== 0));
  }, [txs, quotes]);

  if (!ready) return <div className="sk-box"><i /><i /><i /></div>;

  return (
    <>
      <div className="controls" style={{ marginBottom: 14 }}>
        <div className="tab-bar">
          <button type="button" className={`tab-btn ${tab === "quote" ? "active" : ""}`} onClick={() => setTab("quote")}>
            報價
          </button>
          <button type="button" className={`tab-btn ${tab === "holdings" ? "active" : ""}`} onClick={() => setTab("holdings")}>
            持股
          </button>
        </div>
        {user ? (
          <span className="chip teal">{user.email}</span>
        ) : (
          <span className="hint">
            未登入：資料存於本機瀏覽器。{" "}
            <Link href="/login" style={{ color: "var(--gold)" }}>
              登入同步
            </Link>
          </span>
        )}
      </div>

      <div className="controls" style={{ marginBottom: 14 }}>
        <select value={active} onChange={(e) => setActive(e.target.value)} aria-label="自選清單">
          {Object.keys(lists).map((k) => (
            <option key={k} value={k}>
              {k}（{(lists[k] ?? []).length}）
            </option>
          ))}
        </select>
        <input
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStock()}
          placeholder="加入 2330 / 台積電"
          aria-label="加入自選"
          style={{ padding: "7px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5, maxWidth: 200 }}
        />
        <button type="button" className="btn" onClick={addStock}>
          加入
        </button>
        <input
          value={newList}
          onChange={(e) => setNewList(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createList()}
          placeholder="新增清單"
          aria-label="新增清單"
          style={{ padding: "7px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5, maxWidth: 140 }}
        />
      </div>

      {tab === "quote" ? (
        activeIds.length === 0 ? (
          <div className="empty-msg">此清單還沒有股票，用上方輸入框加入。</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>代號 / 名稱</th>
                  <th className="num">收盤</th>
                  <th className="num">漲跌%</th>
                  <th className="num">成交量</th>
                  <th>訊號</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {activeIds.map((sid) => {
                  const q = quotes[sid];
                  const sig = signalsFor(sid, q?.name ?? "");
                  return (
                    <tr key={sid}>
                      <td>
                        <Link href={`/stock/${sid}`}>{sid}</Link> {q?.name ?? "…"}
                      </td>
                      <td className="num">{q ? fmt(q.close, 2) : "—"}</td>
                      <td className={`num ${q ? pctClass(q.change_pct) : ""}`}>{q ? `${fmtSigned(q.change_pct)}%` : "—"}</td>
                      <td className="num">{q ? fmt(q.volume, 0) : "—"}</td>
                      <td>
                        {sig.news > 0 && (
                          <Link href={`/stock/${sid}`} className="badge red" title="近期有重大消息">
                            新聞 {sig.news}
                          </Link>
                        )}
                        {sig.rev && <span className="badge gold" title="最新月營收已公布">營收</span>}
                        {sig.news === 0 && !sig.rev && <span className="hint">—</span>}
                      </td>
                      <td>
                        <button type="button" className="btn-reset" onClick={() => removeStock(sid)}>
                          移除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="section-title" style={{ marginTop: 0 }}>
              新增 / 編輯交易
              <span className="hint">平均成本法，可多筆買賣</span>
            </div>
            <div className="controls">
              <input
                value={txForm.sid}
                onChange={(e) => setTxForm((f) => ({ ...f, sid: e.target.value }))}
                placeholder="股號（如 2330）"
                aria-label="股號"
                style={{ width: 110, ...inputStyle }}
              />
              <select
                value={txForm.side}
                onChange={(e) => setTxForm((f) => ({ ...f, side: e.target.value as "buy" | "sell" }))}
                aria-label="買賣"
              >
                <option value="buy">買進</option>
                <option value="sell">賣出</option>
              </select>
              <input type="number" value={txForm.shares || ""} onChange={(e) => setTxForm((f) => ({ ...f, shares: Number(e.target.value) }))} placeholder="股數" aria-label="股數" style={{ width: 110, ...inputStyle }} />
              <input type="number" step="0.01" value={txForm.price || ""} onChange={(e) => setTxForm((f) => ({ ...f, price: Number(e.target.value) }))} placeholder="價格" aria-label="價格" style={{ width: 110, ...inputStyle }} />
              <input type="date" value={txForm.date} onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))} aria-label="日期" style={{ ...inputStyle }} />
              <button type="button" className="btn primary" onClick={saveTx}>
                {editTx ? "儲存修改" : "新增交易"}
              </button>
              {editTx && (
                <button type="button" className="btn-reset" onClick={() => { setEditTx(null); setTxForm(newTx("")); }}>
                  取消
                </button>
              )}
            </div>
          </div>
          {holdings.length === 0 ? (
            <div className="empty-msg">尚無持股交易。加入一筆買進即可開始。</div>
          ) : (
            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-label">持股檔數</div>
                <div className="summary-val">{holdings.filter((h) => h.pos!.shares > 0).length}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">總市值</div>
                <div className="summary-val">{fmt(holdings.reduce((s, h) => s + h.pos!.marketValue, 0), 0)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">總損益</div>
                <div className={`summary-val ${pctClass(holdings.reduce((s, h) => s + h.pos!.pl, 0))}`}>
                  {fmtSigned(holdings.reduce((s, h) => s + h.pos!.pl, 0), 0)}
                </div>
              </div>
            </div>
          )}
          {holdings.map((h) => {
            const p = h.pos!;
            return (
              <div className="card" key={h.sid} style={{ marginBottom: 12 }}>
                <div className="section-title" style={{ marginTop: 0 }}>
                  <Link href={`/stock/${h.sid}`}>{h.name} {h.sid}</Link>
                  <span className={`summary-val ${pctClass(p.pl)}`} style={{ fontSize: 16 }}>{fmtSigned(p.pl, 0)}（{fmtSigned(p.plPct)}%）</span>
                </div>
                <div className="summary-cards" style={{ marginBottom: 10 }}>
                  <div className="summary-card"><div className="summary-label">持股</div><div className="summary-val">{fmt(p.shares, 0)} 股</div></div>
                  <div className="summary-card"><div className="summary-label">平均成本</div><div className="summary-val">{fmt(p.avgCost, 2)}</div></div>
                  <div className="summary-card"><div className="summary-label">市值</div><div className="summary-val">{fmt(p.marketValue, 0)}</div></div>
                  <div className="summary-card"><div className="summary-label">已實現</div><div className={`summary-val ${pctClass(p.realized)}`}>{fmtSigned(p.realized, 0)}</div></div>
                </div>
                <div className="mega-col-title">損益曲線</div>
                <CurveChart points={h.curve} />
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table style={{ fontSize: 12.5 }}>
                    <thead>
                      <tr>
                        <th>日期</th><th>買賣</th><th className="num">股數</th><th className="num">價格</th><th className="num">金額</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {txs.filter((t) => t.sid === h.sid).sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                        <tr key={t.id}>
                          <td>{t.date}</td>
                          <td className={t.side === "buy" ? "up" : "down"}>{t.side === "buy" ? "買進" : "賣出"}</td>
                          <td className="num">{fmt(t.shares, 0)}</td>
                          <td className="num">{fmt(t.price, 2)}</td>
                          <td className="num">{fmt(t.shares * t.price, 0)}</td>
                          <td>
                            <button type="button" className="btn-reset" onClick={() => { setEditTx(t); setTxForm(t); }}>編輯</button>{" "}
                            <button type="button" className="btn-reset" onClick={() => deleteTx(t.id)}>刪除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

const inputStyle = { padding: "7px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5 } as const;

function CurveChart({ points }: { points: { date: string; value: number }[] }) {
  if (!points.length) return null;
  const W = 560, H = 120, pad = 10;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 0);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(points.length - 1, 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const color = vals[vals.length - 1] >= 0 ? "var(--red)" : "var(--green)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={pad} y1={y(0)} x2={W - pad} y2={y(0)} stroke="var(--border)" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="3" fill={color}>
          <title>{`${p.date} ${fmtSigned(p.value, 0)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
