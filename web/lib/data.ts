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
