import type { Metadata, Viewport } from "next";
import "./globals.css";
import Topbar from "@/components/Topbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";

export const metadata: Metadata = {
  title: {
    default: "盤後通 — 台股盤後分析",
    template: "%s — 盤後通",
  },
  description: "台股盤後資料整理：大盤快報、自選股追蹤、法人籌碼、選股模組，每日自動更新。",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t);var s=JSON.parse(localStorage.getItem('app_settings')||'null');if(s&&s.colorMode)document.documentElement.setAttribute('data-color-mode',s.colorMode)}catch(e){}window.addEventListener('pageshow',function(e){if(e.persisted)location.reload()})})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
