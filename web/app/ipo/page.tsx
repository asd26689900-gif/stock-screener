import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "股票抽籤" };

export default function Page() {
  return <PlaceholderPage title="股票抽籤" desc="申購抽籤資訊" phase="第 4 批" />;
}
