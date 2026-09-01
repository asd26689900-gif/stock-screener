import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "選股模組" };

export default function Page() {
  return <PlaceholderPage title="選股模組" desc="盤後模組篩選結果（linear slider tabs）" phase="第 3 批" />;
}
