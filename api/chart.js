// Vercel Serverless Function — 代理 Yahoo Finance 分K資料
// GET /api/chart?sid=2330&interval=5m&range=1d
// interval: 1m,5m,15m,30m,60m,1d  range: 1d,5d,1mo,3mo
export default async function handler(req, res) {
  const { sid, interval = '5m', range = '1d', market = 'tw' } = req.query;
  if (!sid) return res.status(400).json({ error: 'missing sid' });

  // market: tw（台股，嘗試 .TW/.TWO）、foreign（美股/日股，代號直接使用，如 AAPL、7203.T、^N225）
  let suffixes;
  if (market === 'foreign') suffixes = [''];
  else suffixes = sid.startsWith('^') ? [''] : ['.TW', '.TWO'];
  let result = null;

  for (const suffix of suffixes) {
    const symbol = sid + suffix;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`;
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const r = data?.chart?.result?.[0];
      if (!r || !r.timestamp) continue;

      const ts = r.timestamp;
      const q = r.indicators?.quote?.[0];
      if (!q) continue;

      const bars = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
        if (c == null) continue;
        // 轉台北時間
        const dt = new Date(ts[i] * 1000);
        const tw = new Date(dt.getTime() + 8 * 3600000);
        const d = tw.toISOString().slice(0, 10);
        const t = tw.toISOString().slice(11, 16);
        bars.push({
          d: interval.includes('d') || interval.includes('w') || interval.includes('mo') ? d : d + ' ' + t,
          o: Math.round((o ?? c) * 100) / 100,
          h: Math.round((h ?? c) * 100) / 100,
          l: Math.round((l ?? c) * 100) / 100,
          c: Math.round(c * 100) / 100,
          v: Math.round((v ?? 0) / 1000) // 張
        });
      }
      result = { symbol, interval, range, bars };
      break;
    } catch (e) {
      continue;
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!result) return res.status(404).json({ error: 'no data', sid });
  return res.status(200).json(result);
}
