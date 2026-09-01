import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "自選股" };

export default function Page() {
  return <PlaceholderPage title="自選股" desc="報價 / 持股雙視圖＋交易帳本（多筆買賣、損益曲線、重大消息與營收訊號）" phase="第 4 批" />;
}
