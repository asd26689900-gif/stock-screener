import type { Metadata } from "next";
import IpoView from "@/components/IpoView";

export const metadata: Metadata = { title: "股票抽籤" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">股票抽籤</h1>
        <p className="page-desc">公開申購抽籤日程與承銷資訊（TWSE）。</p>
      </div>
      <IpoView />
    </div>
  );
}
