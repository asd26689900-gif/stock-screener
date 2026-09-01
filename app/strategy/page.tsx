import type { Metadata } from "next";
import { getStrategies } from "@/lib/data";
import StrategiesView from "@/components/StrategiesView";

export const metadata: Metadata = { title: "選股策略" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getStrategies();
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">選股策略</h1>
        <p className="page-desc">四種不同角度的盤後資料篩選。本系統僅提供數據整理，不構成任何買賣建議。</p>
      </div>
      {data ? (
        <StrategiesView strategies={data.strategies} date={data.date} />
      ) : (
        <div className="empty-msg">無法載入資料</div>
      )}
    </div>
  );
}
