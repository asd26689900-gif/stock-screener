import type { Metadata } from "next";
import MonthHistory from "@/components/MonthHistory";

export const metadata: Metadata = { title: "歷史漲跌幅" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">歷史漲跌幅</h1>
        <p className="page-desc">加權指數每月每日收盤與漲跌點數。</p>
      </div>
      <MonthHistory />
    </div>
  );
}
