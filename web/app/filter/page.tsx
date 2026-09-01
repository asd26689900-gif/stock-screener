import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "自訂篩選" };

export default function Page() {
  return <PlaceholderPage title="自訂篩選" desc="依技術 / 籌碼 / 基本面指標篩選" phase="第 3 批" />;
}
