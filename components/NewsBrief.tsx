import { sb } from "@/lib/supabase";
import { fmtTw } from "@/lib/format";

type NewsItem = { title: string; link: string; source: string; published: string };

async function getNews(limit = 8): Promise<NewsItem[]> {
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("daily_news")
      .select("title,link,source,published")
      .order("published", { ascending: false })
      .limit(limit);
    return (data ?? []) as NewsItem[];
  } catch {
    return [];
  }
}

export default async function NewsBrief() {
  const news = await getNews();

  if (!news.length) {
    return (
      <div className="card" style={{ padding: "14px 16px" }}>
        <div className="section-title" style={{ margin: 0 }}>新聞晨報</div>
        <p className="hint" style={{ marginTop: 8 }}>暫無新聞（每日 08:30 更新）</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div className="section-title" style={{ margin: "0 0 8px" }}>
        新聞晨報
        <span className="chip teal">{news.length} 則</span>
      </div>
      <div className="news-list">
        {news.map((n, i) => (
          <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="news-item">
            <span className="news-title">{n.title}</span>
            <span className="news-meta">
              {n.source} · {fmtTw(n.published)}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
