import { sb } from "./supabase";
import type { InstRow } from "@/components/InstitutionalPanel";
import type { KBar } from "@/components/KChart";

export type StockPageData = {
  sid: string;
  name: string;
  industry: string;
  quote: {
    close: number;
    change: number;
    changePct: number;
    volume: number;
    date: string;
    ma5?: number;
    ma10?: number;
    ma20?: number;
    ma60?: number;
    pe?: number;
    pb?: number;
    dy?: number;
    revMom?: number;
    revYoy?: number;
  };
  bars: KBar[];
  instRows: InstRow[];
  chip?: {
    mainNet?: number;
    retailNet?: number;
    bigHolderPct?: number;
    retailHolderPct?: number;
    holderSrc?: string;
    tdccLevels?: Record<string, number>;
  };
  scores?: Record<string, number>;
  revenue?: { m: string; rev: number; mom?: number; yoy?: number }[];
};

/** 用代號或名稱解析 stock_id */
export async function resolveStock(query: string): Promise<{ stock_id: string; name: string } | null> {
  if (!sb) return null;
  const q = query.trim();
  if (!q) return null;
  try {
    if (/^\d{4,6}$/.test(q)) {
      const { data } = await sb.from("stock_metrics").select("stock_id,name").eq("stock_id", q).limit(1);
      if (data?.[0]) return { stock_id: data[0].stock_id, name: data[0].name ?? q };
    }
    const { data } = await sb.from("stock_metrics").select("stock_id,name").ilike("name", `%${q}%`).limit(1);
    if (data?.[0]) return { stock_id: data[0].stock_id, name: data[0].name ?? q };
  } catch {
    return null;
  }
  return null;
}

export async function getStockPage(sid: string): Promise<StockPageData | null> {
  if (!sb) return null;
  try {
    const [metricsRes, stkRes, pricesRes] = await Promise.all([
      sb.from("stock_metrics").select("*").eq("stock_id", sid).limit(1),
      sb.from("daily_stk").select("date,data").eq("stock_id", sid).order("date", { ascending: false }).limit(1),
      sb.from("stock_prices").select("stock_id,date,open,high,low,close,volume").eq("stock_id", sid).order("date", { ascending: false }).limit(260),
    ]);
    const metrics = metricsRes.data?.[0];
    const stk = stkRes.data?.[0] as { date: string; data: Record<string, unknown> } | undefined;
    const prices = pricesRes.data ?? [];
    const d = stk?.data ?? {};

    const history = (d.history as { d: string; o: number; h: number; l: number; c: number; v: number }[]) ?? [];
    const bars: KBar[] =
      history.length >= 30
        ? history.map((b) => ({ d: b.d, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v ?? 0 }))
        : prices
            .slice()
            .reverse()
            .map((p) => ({ d: p.date, o: p.open ?? p.close, h: p.high ?? p.close, l: p.low ?? p.close, c: p.close, v: p.volume ?? 0 }));

    const instHist = (d.inst_hist as { date: string; foreign_net: number; trust_net: number; dealer_net: number }[]) ?? [];
    const fundamental = (d.fundamental ?? {}) as { pe?: number; pb?: number; dividend_yield?: number };
    const revenue = (d.revenue as { m: string; rev: number; mom?: number; yoy?: number }[]) ?? [];

    return {
      sid,
      name: (d.name as string) || metrics?.name || sid,
      industry: String((d.industry as string) || ""),
      quote: {
        close: Number(d.close ?? metrics?.close ?? 0),
        change: Number(d.change ?? 0),
        changePct: Number(d.change_pct ?? metrics?.change_pct ?? 0),
        volume: Number(d.volume ?? metrics?.volume ?? 0),
        date: String(d.date ?? stk?.date ?? ""),
        ma5: metrics?.ma5,
        ma10: metrics?.ma10,
        ma20: metrics?.ma20,
        ma60: metrics?.ma60,
        pe: fundamental.pe,
        pb: fundamental.pb,
        dy: fundamental.dividend_yield,
        revMom: metrics?.rev_mom,
        revYoy: metrics?.rev_yoy,
      },
      bars,
      instRows: instHist.map((r) => ({
        date: r.date,
        foreign_net: r.foreign_net ?? 0,
        trust_net: r.trust_net ?? 0,
        dealer_net: r.dealer_net ?? 0,
      })),
      chip: d.chip as StockPageData["chip"],
      scores: d.scores as Record<string, number> | undefined,
      revenue,
    };
  } catch {
    return null;
  }
}

export type ConceptStock = {
  stock_id: string;
  name: string;
  close: number | null;
  change_pct: number | null;
  volume: number;
  industry: string;
  role: string;
  foreign_net_shares: number;
  trust_net_shares: number;
  rev_yoy: number | null;
  date: string | null;
  returns: { d1: number | null; d5: number | null; d20: number | null; d60: number | null };
  signals: number;
  scoreFund: number | null;
  scoreTech: number | null;
  pe: number | null;
};

function pctFrom(base: number | undefined, cur: number | undefined): number | null {
  if (base == null || cur == null || !base) return null;
  return Math.round(((cur - base) / base) * 10000) / 100;
}

/** 單題材成分股：報價＋1/5/20/60日報酬（stock_prices）＋訊號數＋品質/估值/法人標籤所需欄位 */
export async function getConceptStocks(ids: string[]): Promise<ConceptStock[]> {
  if (!sb || !ids.length) return [];
  try {
    const cutoff = new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const [metricsRes, pricesRes, stkRes] = await Promise.all([
      sb.from("stock_metrics").select("stock_id,name,close,change_pct,volume,foreign_net_shares,trust_net_shares,rev_yoy,date,industry").in("stock_id", ids),
      sb.from("stock_prices").select("stock_id,date,close").in("stock_id", ids).gte("date", cutoff).order("date", { ascending: true }),
      sb.from("daily_stk").select("stock_id,date,data").in("stock_id", ids).order("date", { ascending: false }).limit(200),
    ]);
    const metricsMap = new Map<string, Record<string, unknown>>();
    for (const m of metricsRes.data ?? []) metricsMap.set(String(m.stock_id), m);

    const closes = new Map<string, number[]>();
    for (const p of pricesRes.data ?? []) {
      const arr = closes.get(String(p.stock_id)) ?? [];
      arr.push(Number(p.close));
      closes.set(String(p.stock_id), arr);
    }

    const stkLatest = new Map<string, { date: string; data: Record<string, unknown> }>();
    for (const r of stkRes.data ?? []) {
      const sid = String(r.stock_id);
      if (!stkLatest.has(sid)) stkLatest.set(sid, { date: r.date, data: r.data as Record<string, unknown> });
    }

    return ids.map((id) => {
      const m = metricsMap.get(id) ?? {};
      const arr = closes.get(id) ?? [];
      const last = arr[arr.length - 1];
      const idx = (n: number) => arr[arr.length - 1 - n];
      const stk = stkLatest.get(id);
      const d = stk?.data ?? {};
      const criteria = (d.criteria ?? {}) as { chip?: string[]; fundamental?: string[]; technical?: string[] };
      const signals = (criteria.chip?.length ?? 0) + (criteria.fundamental?.length ?? 0) + (criteria.technical?.length ?? 0);
      const scores = (d.scores ?? {}) as { chip?: number; fundamental?: number; technical?: number };
      const fundamental = (d.fundamental ?? {}) as { pe?: number };
      const industry = String(m.industry ?? "");
      return {
        stock_id: id,
        name: String(m.name ?? id),
        close: last != null ? last : m.close != null ? Number(m.close) : null,
        change_pct: m.change_pct != null ? Number(m.change_pct) : null,
        volume: Number(m.volume ?? 0),
        industry,
        role: industry || "成分股",
        foreign_net_shares: Number(m.foreign_net_shares ?? 0),
        trust_net_shares: Number(m.trust_net_shares ?? 0),
        rev_yoy: m.rev_yoy != null ? Number(m.rev_yoy) : null,
        date: m.date != null ? String(m.date) : stk?.date ?? null,
        returns: {
          d1: pctFrom(idx(1), last),
          d5: pctFrom(idx(5), last),
          d20: pctFrom(idx(20), last),
          d60: pctFrom(idx(60), last),
        },
        signals,
        scoreFund: scores.fundamental != null ? Number(scores.fundamental) : null,
        scoreTech: scores.technical != null ? Number(scores.technical) : null,
        pe: fundamental.pe != null ? Number(fundamental.pe) : null,
      };
    });
  } catch {
    return [];
  }
}
