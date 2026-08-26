// Vercel Serverless — 代理 TWSE 各種公開 API (避免 CORS)
// GET /api/twse-proxy?type=margin&date=20260819
// GET /api/twse-proxy?type=index_daily&date=202608
// GET /api/twse-proxy?type=ipo
// GET /api/twse-proxy?type=dividend
// GET /api/twse-proxy?type=earnings   （已公告季報清單）
export default async function handler(req, res) {
  const { type, date } = req.query;
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=600');

  try {
    if (type === 'margin') {
      // 融資融券 — TWSE 信用交易統計（資料約 21:00 發布，未發布時往前找最近有資料的日期）
      const d = date || new Date().toISOString().slice(0,10).replace(/-/g,'');
      let found = null;
      for (let i = 0; i < 10; i++) {
        const dt = new Date(parseInt(d.slice(0,4), 10), parseInt(d.slice(4,6), 10) - 1, parseInt(d.slice(6,8), 10) - i);
        const ds = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}`;
        const r = await fetch(
          `https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?response=json&date=${ds}&selectType=STOCK`,
          { headers: { 'User-Agent': UA } }
        );
        const j = await r.json();
        if (j.stat === 'OK' && j.tables && j.tables.some(t => t.data && t.data.length)) {
          found = j;
          break;
        }
      }
      return res.json(found || { stat: 'OK', date: d, tables: [] });
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
      // TWSE 已將 publicLottery 改版為 publicForm（公開申購公告-抽籤日程表）
      const url = 'https://www.twse.com.tw/rwd/zh/announcement/publicForm?response=json';
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await r.json();
      return res.json(j);
    }

    if (type === 'earnings') {
      // 已公告季報清單 — openapi.twse
      // 回傳: [{出表日期(民國), 年度, 季別, 公司代號, 公司名稱, 基本每股盈餘(元), ...}]
      const url = 'https://openapi.twse.com.tw/v1/opendata/t187ap14_L';
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await r.json();
      return res.json(j);
    }

    if (type === 'dividend') {
      // 除權息公告 — date 可以是 YYYYMM(月查詢) 或 YYYYMMDD(日查詢)
      // 民國年: 11508 → startDate=11508/01, endDate=11508/31
      const d = date || '';
      let startDate, endDate;
      if (d.length <= 5) {
        // 月查詢: 11508 → 整月
        startDate = d + '01';
        const rocY = parseInt(d.slice(0,3));
        const mm = parseInt(d.slice(3));
        const daysInMonth = new Date(rocY + 1911, mm, 0).getDate();
        endDate = d + String(daysInMonth).padStart(2, '0');
      } else {
        startDate = d;
        endDate = d;
      }
      const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49U?response=json&startDate=${startDate}&endDate=${endDate}`;
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await r.json();
      return res.json(j);
    }

    return res.status(400).json({ error: 'unknown type' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
