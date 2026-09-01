import { NextRequest, NextResponse } from "next/server";

// 代理 Yahoo Finance 分K資料（沿用舊站 api/chart.js）
// GET /api/chart?sid=2330&interval=5m&range=1d&market=tw

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sid = sp.get("sid") ?? "";
  const interval = sp.get("interval") ?? "5m";
  const range = sp.get("range") ?? "1d";
  const market = sp.get("market") ?? "tw";
  if (!sid) return NextResponse.json({ error: "missing sid" }, { status: 400 });

  const suffixes = market === "foreign" ? [""] : sid.startsWith("^") ? [""] : [".TW", ".TWO"];
  let result: { symbol: string; interval: string; range: string; bars: unknown[] } | null = null;

  for (const suffix of suffixes) {
    const symbol = sid + suffix;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
    try {
      const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      if (!resp.ok) continue;
      const data = await resp.json();
      const r = data?.chart?.result?.[0];
      if (!r || !r.timestamp) continue;
      const ts = r.timestamp as number[];
      const q = r.indicators?.quote?.[0];
      if (!q) continue;
      const bars: { d: string; o: number; h: number; l: number; c: number; v: number }[] = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
        if (c == null) continue;
        const dt = new Date(ts[i] * 1000);
        const tw = new Date(dt.getTime() + 8 * 3600000);
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
      result = { symbol, interval, range, bars };
      break;
    } catch {
      continue;
    }
  }

  if (!result) return NextResponse.json({ error: "no data", sid }, { status: 404 });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
