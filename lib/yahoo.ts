// Server 端 Yahoo Finance 分K helper（沿用 /api/chart 邏輯，供 server component 直接取大盤資料）
export type YahooBar = { d: string; o: number; h: number; l: number; c: number; v: number };

export async function getYahooBars(sid: string, interval = "1d", range = "6mo", market = "tw"): Promise<YahooBar[]> {
  const suffixes = market === "foreign" ? [""] : sid.startsWith("^") ? [""] : [".TW", ".TWO"];
  for (const suffix of suffixes) {
    const symbol = sid + suffix;
    try {
      const resp = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(15000) },
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const r = data?.chart?.result?.[0];
      if (!r?.timestamp) continue;
      const ts = r.timestamp as number[];
      const q = r.indicators?.quote?.[0];
      if (!q) continue;
      const bars: YahooBar[] = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
        if (c == null) continue;
        const tw = new Date(new Date(ts[i] * 1000).getTime() + 8 * 3600000);
        const d = tw.toISOString().slice(0, 10);
        const t = tw.toISOString().slice(11, 16);
        bars.push({
          d: /(d|w|mo)$/.test(interval) ? d : `${d} ${t}`,
          o: Math.round((o ?? c) * 100) / 100,
          h: Math.round((h ?? c) * 100) / 100,
          l: Math.round((l ?? c) * 100) / 100,
          c: Math.round(c * 100) / 100,
          v: Math.round((v ?? 0) / 1000),
        });
      }
      if (bars.length) return bars;
    } catch {
      continue;
    }
  }
  return [];
}

export type Returns = { d1: number | null; d5: number | null; d20: number | null; d60: number | null };

export function retFromCloses(closes: number[]): Returns {
  const idx = (n: number) => {
    if (closes.length < n + 1) return null;
    const base = closes[closes.length - 1 - n];
    const cur = closes[closes.length - 1];
    if (!base) return null;
    return Math.round(((cur - base) / base) * 10000) / 100;
  };
  return { d1: idx(1), d5: idx(5), d20: idx(20), d60: idx(60) };
}

export async function getIndexReturns(): Promise<Returns> {
  const bars = await getYahooBars("^TWII", "1d", "6mo");
  return retFromCloses(bars.map((b) => b.c));
}
