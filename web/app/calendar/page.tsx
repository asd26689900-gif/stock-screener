import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "投資行事曆" };

export default function Page() {
  return <PlaceholderPage title="投資行事曆" desc="除權息 / 財報 / 抽籤 / 增資事件（群組上限＋自選股標記）" phase="第 4 批" />;
}
