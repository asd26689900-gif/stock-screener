import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "個股分析" };

export default function Page() {
  return (
    <PlaceholderPage
      title="個股分析"
      desc="報價 / K線 / 法人 / 集保 / 基本面與營收（新版：法人當日柱狀＋累計曲線、大戶小戶門檻滑桿）"
      phase="第 2 批"
    />
  );
}
