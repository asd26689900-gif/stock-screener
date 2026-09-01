import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "選股策略" };

export default function Page() {
  return <PlaceholderPage title="選股策略" desc="法人連續買進、主散對做、營收翻多等策略" phase="第 3 批" />;
}
