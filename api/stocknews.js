// Vercel Serverless — 個股新聞・公告聚合（Google News RSS 代理，避免 CORS）
// GET /api/stocknews?sym=2330&name=台積電
export default async function handler(req, res) {
  const sym = String(req.query.sym || '').trim();
  const name = String(req.query.name || '').trim();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=1800');
  if (!name && !sym) return res.status(400).json({ error: 'need sym or name' });

  const q1 = name ? `${name} 重大訊息 OR 公告` : `${sym} 重大訊息`;
  let items = await fetchRss(q1);
  if (items.length < 3 && name) items = items.concat(await fetchRss(name));
  res.json({ items: items.slice(0, 10) });
}

async function fetchRss(q) {
  const url = 'https://news.google.com/rss/search?' + new URLSearchParams({
    q, hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant'
  });
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'zh-TW,zh;q=0.9' }
    });
    if (!r.ok) return [];
    const t = await r.text();
    const out = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(t)) && out.length < 10) {
      const body = m[1];
      const pick = (tag) => {
        const mm = body.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
        return mm ? mm[1].trim() : '';
      };
      const title = pick('title');
      const link = pick('link');
      if (!title || !link) continue;
      const pub = pick('pubDate');
      const srcM = body.match(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/);
      const descM = body.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
      out.push({
        title,
        link,
        source: srcM ? srcM[1].trim() : '',
        published_at: pub ? new Date(pub).toISOString() : null,
        snippet: descM ? descM[1].replace(/<[^>]+>/g, '').slice(0, 200) : ''
      });
    }
    return out;
  } catch (e) {
    return [];
  }
}
