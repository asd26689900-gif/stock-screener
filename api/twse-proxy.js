// Vercel Serverless — 代理 TWSE 各種公開 API (避免 CORS)
// GET /api/twse-proxy?type=margin&date=20260819
// GET /api/twse-proxy?type=index_daily&date=202608
// GET /api/twse-proxy?type=ipo
// GET /api/twse-proxy?type=dividend
export default async function handler(req, res) {
  const { type, date } = req.query;
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=600');

  try {
    if (type === 'margin') {
      // 融資融券 — TWSE 信用交易統計
      const d = date || new Date().toISOString().slice(0,10).replace(/-/g,'');
      const url = `https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?response=json&date=${d}&selectType=STOCK`;
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await r.json();
      return res.json(j);
    }

    if (type === 'index_daily') {
      // 大盤每日收盤 — 加權指數月統計
      const d = date || new Date().toISOString().slice(0,7).replace(/-/g,'');
      const url = `https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?response=json&date=${d}01`;
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await r.json();
      return res.json(j);
    }

    if (type === 'ipo') {
      // 公開申購 — TWSE 抽籤資訊
      const url = 'https://www.twse.com.tw/rwd/zh/announcement/publicLottery?response=json';
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await r.json();
      return res.json(j);
    }

    if (type === 'dividend') {
      // 除權息公告
      const d = date || new Date().toISOString().slice(0,10).replace(/-/g,'');
      const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49U?response=json&startDate=${d}&endDate=${d}`;
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await r.json();
      return res.json(j);
    }

    return res.status(400).json({ error: 'unknown type' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
