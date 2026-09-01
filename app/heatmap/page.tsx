import type { Metadata } from "next";
import { getHeatmap } from "@/lib/data";
import HeatmapView from "@/components/HeatmapView";

export const metadata: Metadata = { title: "產業熱力圖" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getHeatmap();
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">產業熱力圖</h1>
        <p className="page-desc">色塊面積 = 市值，顏色 = 漲跌幅。點擊產業可展開成分股。</p>
      </div>
      {data ? (
        <HeatmapView industries={data.industries} date={data.date} />
      ) : (
        <div className="empty-msg">尚無資料</div>
      )}
    </div>
  );
}
