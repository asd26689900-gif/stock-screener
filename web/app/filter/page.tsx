import type { Metadata } from "next";
import FilterBuilder from "@/components/FilterBuilder";

export const metadata: Metadata = { title: "自訂篩選" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">自訂篩選</h1>
        <p className="page-desc">自由調整篩選條件，從 stock_metrics 表即時查詢。每日盤後更新指標。</p>
      </div>
      <FilterBuilder />
    </div>
  );
}
