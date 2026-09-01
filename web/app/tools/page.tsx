import type { Metadata } from "next";
import ToolsCalc from "@/components/ToolsCalc";

export const metadata: Metadata = { title: "股票計算機" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">股票計算機</h1>
        <p className="page-desc">免費台股投資試算工具，算清楚每一筆交易。</p>
      </div>
      <ToolsCalc />
    </div>
  );
}
