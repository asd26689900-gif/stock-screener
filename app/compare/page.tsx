import type { Metadata } from "next";
import CompareView from "@/components/CompareView";

export const metadata: Metadata = { title: "股票比較" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">股票比較</h1>
        <p className="page-desc">選 2-5 支股票，並排比較價格、法人、營收等關鍵指標。</p>
      </div>
      <CompareView />
    </div>
  );
}
