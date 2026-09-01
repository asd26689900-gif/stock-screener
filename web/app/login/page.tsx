import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "登入" };

export default function Page() {
  return <PlaceholderPage title="登入" desc="選用登入：同步自選 / 持股 / 評分；未登入照常以瀏覽器端使用" phase="第 4 批" />;
}
