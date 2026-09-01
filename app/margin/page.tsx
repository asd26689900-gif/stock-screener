import type { Metadata } from "next";
import MarginView from "@/components/MarginView";

export const metadata: Metadata = { title: "融資融券" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">融資融券</h1>
        <p className="page-desc">融資 / 融券增減排行，TWSE 信用交易統計，每日 22:00 後更新。</p>
      </div>
      <MarginView />
    </div>
  );
}
