import type { Metadata } from "next";
import { sb } from "@/lib/supabase";
import DispositionView from "@/components/DispositionView";

export const metadata: Metadata = { title: "處置股預警" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!sb) {
    return (
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">處置股預警</h1>
        </div>
        <div className="empty-msg">預警資料尚未產生</div>
      </div>
    );
  }
  const { data } = await sb.from("daily_disposition").select("date,data").order("date", { ascending: false }).limit(1);
  const row = data?.[0] as { date: string; data: { list?: unknown[]; counts?: Record<string, number> } } | undefined;
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">處置股預警</h1>
        <p className="page-desc">TWSE/TPEX 公告＋機械分級預警，每日 19:00 更新。</p>
      </div>
      {row ? (
        <DispositionView
          date={row.date}
          list={(row.data.list ?? []) as never[]}
          counts={row.data.counts ?? {}}
        />
      ) : (
        <div className="empty-msg">
          預警資料尚未產生
          <br />
          <span className="hint">每日 19:00 自動更新（處置公告發布後）</span>
        </div>
      )}
    </div>
  );
}
