import { sb } from "./supabase";

export type FocusData = {
  date?: string;
  strong?: { day?: Row[]; week?: Row[]; month?: Row[] };
  big_buyer?: { date?: string; rows?: Row[]; fallback?: boolean };
  institutional?: {
    date?: string;
    foreign_top?: Row[];
    trust_top?: Row[];
    dealer_top?: Row[];
    both_buy?: number;
  };
  etf?: {
    all?: Row[];
    top_amount?: Row[];
    active?: Row[];
    active_count?: number;
  };
  margin?: {
    date?: string;
    m_up?: MarginRow[];
    m_dn?: MarginRow[];
    s_up?: MarginRow[];
    s_dn?: MarginRow[];
  };
};

export type Row = [string, string, number, number, number, number?, number?, boolean?];
export type MarginRow = { id: string; name: string; m_prev: number; m_today: number; s_prev: number; s_today: number };

export async function getLatestExecutionTimes(): Promise<Record<string, string>> {
  if (!sb) return {};
  try {
    const { data } = await sb
      .from("execution_log")
      .select("job, status, finished_at")
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(300);
    const map: Record<string, string> = {};
    for (const r of data ?? []) {
      if (!map[r.job] && r.finished_at) map[r.job] = r.finished_at;
    }
    return map;
  } catch {
    return {};
  }
}

export async function getLatestFocus(): Promise<{ date: string; data: FocusData } | null> {
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("daily_focus")
      .select("date,data")
      .order("date", { ascending: false })
      .limit(1);
    return (data?.[0] as { date: string; data: FocusData }) ?? null;
  } catch {
    return null;
  }
}

export async function getLatestModules(moduleKey: string): Promise<{ date: string; data: unknown } | null> {
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("daily_modules")
      .select("date,data")
      .eq("module_key", moduleKey)
      .order("date", { ascending: false })
      .limit(1);
    return (data?.[0] as { date: string; data: unknown }) ?? null;
  } catch {
    return null;
  }
}

export async function getModuleDates(limit = 60): Promise<string[]> {
  if (!sb) return [];
  try {
    const { data } = await sb.from("daily_modules").select("date").order("date", { ascending: false }).limit(limit);
    return [...new Set((data ?? []).map((r) => r.date as string))];
  } catch {
    return [];
  }
}

export async function getModulesForDate(date?: string): Promise<{ date: string; modules: Record<string, Row[]> } | null> {
  if (!sb) return null;
  try {
    let target = date;
    if (!target) {
      const { data: latest } = await sb.from("daily_modules").select("date").order("date", { ascending: false }).limit(1);
      target = (latest?.[0]?.date as string) ?? undefined;
    }
    if (!target) return null;
    const { data } = await sb.from("daily_modules").select("module_key,data").eq("date", target);
    const modules: Record<string, Row[]> = {};
    for (const r of data ?? []) modules[r.module_key] = r.data as Row[];
    return { date: target, modules };
  } catch {
    return null;
  }
}

export async function getStrategies(): Promise<{
  date: string;
  strategies: Record<string, Row[]>;
} | null> {
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("daily_strategies")
      .select("strategy_key,data,date")
      .order("date", { ascending: false })
      .limit(4);
    if (!data?.length) return null;
    const strategies: Record<string, Row[]> = {};
    for (const r of data ?? []) strategies[r.strategy_key] = r.data as Row[];
    return { date: String(data[0].date), strategies };
  } catch {
    return null;
  }
}

export async function getHeatmap(): Promise<{ date: string; industries: HeatIndustry[] } | null> {
  if (!sb) return null;
  try {
    const { data } = await sb.from("daily_heatmap").select("date,data").order("date", { ascending: false }).limit(1);
    const d = data?.[0] as { date: string; data: { industries?: HeatIndustry[] } } | undefined;
    if (!d) return null;
    return { date: d.date, industries: d.data.industries ?? [] };
  } catch {
    return null;
  }
}

export type HeatIndustry = {
  name: string;
  total_amount: number;
  avg_chg: number;
  stocks?: { id: string; name: string; close: number; chg_pct: number; mcap: number; amount: number }[];
};

export type InstMetrics = {
  stock_id: string;
  name: string;
  date: string | null;
  close: number;
  change_pct: number;
  volume: number;
  foreign_net_shares: number;
  foreign_consec_days: number;
  trust_net_shares: number;
  trust_consec_days: number;
  dealer_net_shares: number;
  dealer_consec_days: number;
  market_type: string;
  industry: string;
};

export async function getInstitutionalMetrics(): Promise<InstMetrics[]> {
  if (!sb) return [];
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
    return all;
  }
  return all;
}

export async function getTdccSnapshots(): Promise<Record<string, Record<string, { big_ratio: number }>>> {
  if (!sb) return {};
  try {
    const { data } = await sb.from("daily_modules").select("date,data").eq("module_key", "tdcc").order("date", { ascending: false }).limit(2);
    const snaps: Record<string, Record<string, { big_ratio: number }>> = {};
    for (const r of data ?? []) snaps[r.date] = r.data as Record<string, { big_ratio: number }>;
    return snaps;
  } catch {
    return {};
  }
}
