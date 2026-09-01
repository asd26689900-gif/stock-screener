import type { Metadata, Viewport } from "next";
import "./globals.css";
import Topbar from "@/components/Topbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";

export const metadata: Metadata = {
  title: {
    default: "盤後精選模組",
    template: "%s — 盤後精選模組",
  },
  description: "台股盤後資料整理：市場總覽、個股分析、三大法人、資券變化、選股策略與題材概念股。",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#F5F2EC" };

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Topbar />
        <main>{children}</main>
        <Footer />
        <BottomNav />
        <BackToTop />
      </body>
    </html>
  );
}
