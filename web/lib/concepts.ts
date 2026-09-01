import { sb } from "./supabase";

export type Concept = {
  key: string;
  title: string;
  desc: string;
  ids: string[];
  tier: number; // 0=上游 1=中游 2=下游
  up: string[];
  down: string[];
  sort?: number;
};

// 靜態回退表（與舊站 js/concepts-data.js 一致；管理頁寫入 DB 後以 DB 為準）
export const FALLBACK_CONCEPTS: Concept[] = [
  { key: "ai_server", title: "AI 伺服器", desc: "AI 訓練/推論伺服器組裝與關鍵零組件供應鏈", ids: ["2382", "3231", "2324", "4938", "3450", "2356", "3005", "6669", "5765", "3035"], tier: 1, up: ["cowos", "ic_design", "memory", "thermal", "pcb", "passive"], down: [] },
  { key: "cowos", title: "CoWoS／先進封裝", desc: "AI 晶片 CoWoS 先進封裝產能擴張受惠供應鏈", ids: ["2330", "3711", "2449", "6770", "3037", "6239", "2351", "4952", "3529"], tier: 0, up: [], down: ["ic_design", "ai_server"] },
  { key: "ic_design", title: "IC 設計", desc: "手機 SoC、利基型與 ASIC 設計服務", ids: ["2454", "3443", "2379", "6415", "3661", "5274", "3034", "2436", "6547"], tier: 0, up: ["cowos"], down: ["ai_server", "robot"] },
  { key: "memory", title: "記憶體", desc: "DRAM/NAND 製造、模組與控制 IC", ids: ["2337", "4967", "6510", "3450", "2344", "8299", "3006"], tier: 0, up: [], down: ["ai_server"] },
  { key: "thermal", title: "散熱", desc: "AI 晶片散熱：氣冷 3D VC 到水冷板/液冷", ids: ["3017", "6230", "2059", "6166", "3032", "3653", "6223"], tier: 0, up: [], down: ["ai_server", "robot"] },
  { key: "pcb", title: "PCB", desc: "ABF 載板、CCL 與高階 HDI", ids: ["4958", "2353", "3037", "8046", "6274", "3673", "2313"], tier: 0, up: [], down: ["ai_server", "apple", "tesla"] },
  { key: "silicon_photonics", title: "矽光子／光通訊", desc: "CPO 共同封裝光學與高速光收發模組", ids: ["2455", "3714", "4966", "6209", "5309", "3702", "2327"], tier: 0, up: [], down: ["ai_server", "leo_satellite"] },
  { key: "passive", title: "被動元件", desc: "MLCC、晶片電阻與電感", ids: ["2327", "3257", "2375", "6285", "2456"], tier: 0, up: [], down: ["ai_server", "apple", "tesla", "leo_satellite"] },
  { key: "robot", title: "機器人", desc: "人形機器人工業自動化關鍵零組件", ids: ["2231", "4523", "2049", "6289", "4510", "1590", "2059"], tier: 1, up: ["ic_design", "thermal"], down: [] },
  { key: "tesla", title: "特斯拉鏈", desc: "電動車 Tier-1 零組件供應鏈", ids: ["2308", "6152", "3661", "2395", "3665", "1513", "2231"], tier: 1, up: ["pcb", "passive", "panel"], down: [] },
  { key: "apple", title: "蘋果概念", desc: "iPhone/Mac 供應鏈核心", ids: ["2317", "2354", "3231", "2474", "6278", "4938", "2498"], tier: 1, up: ["pcb", "passive", "panel"], down: [] },
  { key: "military", title: "軍工", desc: "國防自主、無人機與太空品供應鏈", ids: ["2208", "2634", "2014", "1513", "2233", "2601", "4722"], tier: 1, up: [], down: [] },
  { key: "finance", title: "金融", desc: "大型金控（市值權值股）", ids: ["2881", "2882", "2886", "2891", "2884", "2880", "5880", "2883"], tier: 2, up: [], down: [] },
  { key: "shipping", title: "航運", desc: "貨櫃三雄、散裝與航空", ids: ["2603", "2609", "2615", "2605", "2606", "2608", "2610"], tier: 2, up: [], down: [] },
  { key: "construction", title: "營建資產", desc: "建商與資產股", ids: ["2504", "2501", "2542", "2520", "5522", "2534", "2527", "2530"], tier: 2, up: [], down: [] },
  { key: "biotech", title: "生技新藥", desc: "新藥研發、CDMO 與疫苗", ids: ["4743", "6472", "4174", "4726", "1734", "4130", "6446"], tier: 1, up: [], down: [] },
  { key: "heavy_elec", title: "重電", desc: "電網強韌化、變壓器與輸配電設備", ids: ["1503", "1504", "1513", "1514", "1519", "8261", "6806"], tier: 0, up: [], down: ["green_energy"] },
  { key: "panel", title: "面板", desc: "TFT-LCD 與電子紙顯示", ids: ["2409", "3481", "6116", "6285", "3050"], tier: 0, up: [], down: ["apple", "tesla"] },
  { key: "green_energy", title: "綠能儲能", desc: "太陽能、離岸風電與儲能系統", ids: ["6464", "3691", "6443", "3576", "6806", "3708", "6244"], tier: 1, up: ["heavy_elec"], down: [] },
  { key: "leo_satellite", title: "低軌衛星", desc: "LEO 衛星地面站設備與天線射頻", ids: ["3231", "2455", "6285", "3380", "5309", "4977", "3714"], tier: 1, up: ["silicon_photonics", "passive"], down: [] },
];

export async function getConcepts(): Promise<Concept[]> {
  if (sb) {
    try {
      const { data } = await sb.from("concepts").select("*").order("sort", { ascending: true });
      if (data?.length) {
        return data.map((c) => ({
          key: String(c.key),
          title: String(c.title),
          desc: String(c.desc || ""),
          ids: Array.isArray(c.ids) ? c.ids.map(String) : [],
          tier: Number(c.tier) || 0,
          up: Array.isArray(c.up) ? c.up.map(String) : [],
          down: Array.isArray(c.down) ? c.down.map(String) : [],
        }));
      }
    } catch {
      // 表不存在 → 靜態回退
    }
  }
  return FALLBACK_CONCEPTS;
}

export async function getConcept(key: string): Promise<Concept | null> {
  const all = await getConcepts();
  return all.find((c) => c.key === key) ?? null;
}
