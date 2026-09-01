import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "股票計算機" };

export default function Page() {
  return <PlaceholderPage title="股票計算機" desc="損益 / 成本 / 報酬率試算" phase="第 4 批" />;
}
