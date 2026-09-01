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
