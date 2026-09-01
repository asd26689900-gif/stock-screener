import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "融資融券" };

export default function Page() {
  return <PlaceholderPage title="融資融券" desc="資券變化排行（22:00 更新）" phase="第 3 批" />;
}
