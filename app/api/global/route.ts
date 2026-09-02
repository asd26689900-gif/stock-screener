import { NextResponse } from "next/server";
import { twDateStr } from "@/lib/format";

// 美股/日股行情（Yahoo Finance v8 chart，一次平行抓取），沿用舊站 api/global.js
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const TW_INDICES = [
  { sym: "^TWII", name: "加權指數" },
  { sym: "^TWOII", name: "櫃買指數" },
];

const US_INDICES = [
  { sym: "^DJI", name: "道瓊工業" },
  { sym: "^IXIC", name: "那斯達克" },
  { sym: "^GSPC", name: "標普 500" },
  { sym: "^SOX", name: "費城半導體" },
];
const US_STOCKS = [
  { sym: "AAPL", name: "蘋果" }, { sym: "NVDA", name: "輝達" }, { sym: "MSFT", name: "微軟" },
  { sym: "AMZN", name: "亞馬遜" }, { sym: "GOOGL", name: "Alphabet" }, { sym: "META", name: "Meta" },
  { sym: "TSLA", name: "特斯拉" }, { sym: "AVGO", name: "博通" }, { sym: "AMD", name: "超微" },
  { sym: "TSM", name: "台積電 ADR" }, { sym: "MU", name: "美光" }, { sym: "INTC", name: "英特爾" },
  { sym: "QCOM", name: "高通" }, { sym: "NFLX", name: "Netflix" }, { sym: "COST", name: "好市多" },
];
const JP_INDICES = [{ sym: "^N225", name: "日經 225" }];
const JP_STOCKS = [
  { sym: "7203.T", name: "豐田" }, { sym: "6758.T", name: "Sony" }, { sym: "9984.T", name: "軟銀" },
  { sym: "8035.T", name: "東京威力科創" }, { sym: "6861.T", name: "基恩士" }, { sym: "6501.T", name: "日立" },
  { sym: "6954.T", name: "發那科" }, { sym: "8306.T", name: "三菱UFJ" }, { sym: "9432.T", name: "NTT" },
  { sym: "4063.T", name: "信越化學" }, { sym: "7741.T", name: "Hoya" }, { sym: "6367.T", name: "大金工業" },
];
const EXTRA = [
  { sym: "TWD=X", name: "美元/台幣" }, { sym: "JPY=X", name: "美元/日圓" }, { sym: "EURUSD=X", name: "歐元/美元" },
  { sym: "BTC-USD", name: "比特幣" }, { sym: "GC=F", name: "黃金期貨" }, { sym: "CL=F", name: "西德州原油" }, { sym: "HG=F", name: "銅期貨" },
];

async function fetchQuote(sym: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res?.timestamp?.length) return null;
    const q = res.indicators?.quote?.[0];
    const bars: number[] = [];
    for (let i = 0; i < res.timestamp.length; i++) {
      const c = q?.close?.[i];
      if (c == null || !Number.isFinite(c)) continue;
      bars.push(c);
    }
    if (bars.length < 2) return null;
    const price = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const chg = price - prev;
    const chgPct = prev ? (chg / prev) * 100 : 0;
    const d = twDateStr(res.timestamp[res.timestamp.length - 1] * 1000);
    return { sym, price: Math.round(price * 100) / 100, chg: Math.round(chg * 100) / 100, chgPct: Math.round(chgPct * 100) / 100, date: d, spark: bars.slice(-22) };
  } catch {
    return null;
  }
}

export async function GET() {
  const symbols = [...TW_INDICES, ...US_INDICES, ...US_STOCKS, ...JP_INDICES, ...JP_STOCKS, ...EXTRA].map((s) => s.sym);
  const map = await Promise.all(symbols.map(async (sym) => [sym, await fetchQuote(sym)] as const));
  const q = Object.fromEntries(map);
  const out = {
    tw: { indices: TW_INDICES.map((s) => ({ ...s, ...(q[s.sym] || {}) })) },
    us: { indices: US_INDICES.map((s) => ({ ...s, ...(q[s.sym] || {}) })), stocks: US_STOCKS.map((s) => ({ ...s, ...(q[s.sym] || {}) })) },
    jp: { indices: JP_INDICES.map((s) => ({ ...s, ...(q[s.sym] || {}) })), stocks: JP_STOCKS.map((s) => ({ ...s, ...(q[s.sym] || {}) })) },
    extra: EXTRA.map((s) => ({ ...s, ...(q[s.sym] || {}) })),
    updated_at: new Date().toISOString(),
  };
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=120" } });
}
