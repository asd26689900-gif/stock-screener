import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "題材概念股" };

export default function Page() {
  return <PlaceholderPage title="題材概念股" desc="題材列表＋單題材頁（仿 finlab：成分股角色、報酬、上下游三層圖）" phase="第 4 批" />;
}
