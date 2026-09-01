import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";

export const metadata: Metadata = { title: "全球股市" };

export default function Page() {
  return <PlaceholderPage title="全球股市" desc="國際指數與主要市場走勢" phase="第 2 批" />;
}
