import type { Metadata } from "next";
import WatchlistApp from "@/components/WatchlistApp";

export const metadata: Metadata = { title: "自選股" };

export default function Page() {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">自選股</h1>
        <p className="page-desc">
          報價 / 持股雙視圖：交易帳本（多筆買賣、損益曲線）、重大消息與營收公布訊號。登入後可跨裝置同步。
        </p>
      </div>
      <WatchlistApp />
    </div>
  );
}
