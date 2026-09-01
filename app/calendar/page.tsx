import type { Metadata } from "next";
import CalendarApp from "@/components/CalendarApp";

export const metadata: Metadata = { title: "投資行事曆" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">投資行事曆</h1>
        <p className="page-desc">除權息 / 股票抽籤 / 財報 / 月營收公告；財報群組上千筆時自動收合。</p>
      </div>
      <CalendarApp />
    </div>
  );
}
