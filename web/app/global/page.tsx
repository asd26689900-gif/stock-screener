import type { Metadata } from "next";
import GlobalView from "@/components/GlobalView";

export const metadata: Metadata = { title: "全球股市" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">全球股市</h1>
        <p className="page-desc">美股與日股主要指數、熱門個股行情與熱力圖。</p>
      </div>
      <GlobalView />
    </div>
  );
}
