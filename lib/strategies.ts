export type StrategyMeta = { title: string; desc: string; rules: string[]; cols: string[] };

export const STRATEGIES: Record<string, StrategyMeta> = {
  trust_chain: { title: "投信連續有感買進", desc: "投信連續買超3日以上且累計張數顯著，搭配股價站上月線確認技術面支撐。", rules: ["投信連買≥3日", "累計買超>500張", "收盤價>MA20", "成交量>5日均量"], cols: ["股號", "名稱", "收盤價", "漲跌%", "成交張", "投信連買日", "投信累買張"] },
  main_retail_split: { title: "主散對做價量齊揚", desc: "主力買超同時散戶賣出，籌碼從弱手流向強手。配合股價上漲且成交量放大。", rules: ["主力當日買超", "散戶當日賣超", "收盤價上漲", "成交量>前日量"], cols: ["股號", "名稱", "收盤價", "漲跌%", "成交張", "主力買超張", "散戶賣超張"] },
  inst_burst: { title: "法人大買爆量超前", desc: "外資或投信單日買超金額異常放大（超過近20日平均2倍），搭配成交量爆量。", rules: ["法人買超>20日均值×2", "成交量>20日均量×1.5", "收盤價>MA5", "KD未超買(K<80)"], cols: ["股號", "名稱", "收盤價", "漲跌%", "成交張", "法人買超張", "量比(倍)"] },
  rev_turn: { title: "股價營收成長翻多", desc: "月營收由衰退轉為正成長（MOM翻正），且股價同步突破月線，基本面拐點出現。", rules: ["前月MOM<0", "最新MOM>0（翻正）", "收盤價突破MA20", "成交量>5日均量"], cols: ["股號", "名稱", "收盤價", "漲跌%", "成交張", "前月MOM", "最新MOM"] },
};

export const STRATEGY_ORDER = ["trust_chain", "main_retail_split", "inst_burst", "rev_turn"];
