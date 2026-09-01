import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "題材概念股" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaceholderPage title={`題材：${id}`} desc="簡介 → 成分股卡片 → 對照大盤 → 上下游三層圖" phase="第 4 批" />;
}
