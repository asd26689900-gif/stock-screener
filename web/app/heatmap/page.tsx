import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "產業熱力圖" };

export default function Page() {
  return <PlaceholderPage title="產業熱力圖" desc="產業漲跌區塊圖" phase="第 3 批" />;
}
