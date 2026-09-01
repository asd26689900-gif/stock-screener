import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "個股分析" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlaceholderPage
      title={`個股分析 ${id}`}
      desc="報價 / K線 / 法人 / 集保 / 基本面與營收"
      phase="第 2 批"
    />
  );
}
