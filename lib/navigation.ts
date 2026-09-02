export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "市場",
    items: [
      { href: "/", label: "市場總覽" },
      { href: "/global", label: "全球股市" },
      { href: "/heatmap", label: "產業熱力圖" },
      { href: "/history", label: "歷史漲跌幅" },
      { href: "/disposition", label: "處置股預警" },
    ],
  },
  {
    label: "選股",
    items: [
      { href: "/modules", label: "選股模組" },
      { href: "/strategy", label: "選股策略" },
      { href: "/concepts", label: "題材概念股" },
    ],
  },
  {
    label: "籌碼",
    items: [
      { href: "/institutional", label: "法人買賣超" },
      { href: "/margin", label: "融資融券" },
      { href: "/etf", label: "ETF 總覽" },
    ],
  },
  {
    label: "工具",
    items: [
      { href: "/filter", label: "自訂篩選" },
      { href: "/compare", label: "股票比較" },
      { href: "/calendar", label: "投資行事曆" },
      { href: "/ipo", label: "股票抽籤" },
      { href: "/tools", label: "股票計算機" },
      { href: "/settings", label: "設定" },
      { href: "/concepts/admin", label: "題材管理" },
    ],
  },
];

export const WATCHLIST_HREF = "/watchlist";
export const LOGIN_HREF = "/login";
