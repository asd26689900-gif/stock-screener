// ── 資料初始化（無登入 / 無付費牆）──
// 依賴：config.js 先載入，supabase.min.js 先載入

let sb = null;

async function initData() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase SDK 未載入');
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (typeof onDataReady === 'function') onDataReady();
}

document.addEventListener('DOMContentLoaded', initData);
