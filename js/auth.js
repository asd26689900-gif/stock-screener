// ── Auth + 付費牆 ──
// 依賴：config.js 先載入，supabase CDN 先載入

let sb = null;
let currentUser = null;
let currentPlan = 'free'; // 'free' | 'pro'

async function initSupabase() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase SDK 未載入');
    return false;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 先嘗試取得現有 session
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      const { data } = await sb.from('subscriptions')
        .select('plan,status')
        .eq('user_id', currentUser.id)
        .single();
      currentPlan = (data && data.status === 'active') ? data.plan : 'free';
    }
  } catch(e) { /* 無 session，繼續 */ }

  updateAuthUI();

  // 監聽後續登入/登出變化
  sb.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
      const { data } = await sb.from('subscriptions')
        .select('plan,status')
        .eq('user_id', currentUser.id)
        .single();
      currentPlan = (data && data.status === 'active') ? data.plan : 'free';
    } else {
      currentPlan = 'free';
    }
    updateAuthUI();
    if (typeof onAuthReady === 'function') onAuthReady();
  });

  return true;
}

function isPro() { return currentPlan === 'pro'; }
function isLoggedIn() { return !!currentUser; }

// ── Auth UI (注入到 topbar) ──
function updateAuthUI() {
  const el = document.getElementById('authArea');
  if (!el) return;
  if (currentUser) {
    const email = currentUser.email || '';
    const short = email.split('@')[0];
    const badge = isPro() ? '<span class="plan-badge pro">PRO</span>' : '<span class="plan-badge free">免費</span>';
    el.innerHTML = `${badge}<span class="user-name">${short}</span><button class="btn-logout" onclick="doLogout()">登出</button>`;
  } else {
    el.innerHTML = `<button class="btn-login" onclick="showAuthModal()">登入</button>`;
  }
}

async function doLogout() {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  currentPlan = 'free';
  updateAuthUI();
  if (typeof onAuthReady === 'function') onAuthReady();
}

// ── Modal ──
function showAuthModal(mode) {
  let modal = document.getElementById('authModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'authModal';
    modal.innerHTML = `
      <div class="auth-overlay" onclick="hideAuthModal()"></div>
      <div class="auth-box" role="dialog" aria-modal="true" aria-label="登入">
        <div class="auth-tabs">
          <button class="auth-tab active" data-mode="login" onclick="switchAuthTab('login')">登入</button>
          <button class="auth-tab" data-mode="signup" onclick="switchAuthTab('signup')">註冊</button>
        </div>
        <div id="authMsg" class="auth-msg" role="status" aria-live="polite"></div>
        <label for="authEmail">Email</label>
        <input type="email" id="authEmail" placeholder="you@example.com" autocomplete="email">
        <label for="authPwd">密碼（至少 6 位）</label>
        <input type="password" id="authPwd" placeholder="••••••" autocomplete="current-password">
        <button class="auth-submit" id="authSubmitBtn" onclick="doAuth()">登入</button>
        <button class="auth-close" onclick="hideAuthModal()">關閉</button>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.classList.add('show');
  switchAuthTab(mode || 'login');
  document.getElementById('authEmail').focus();
  document.addEventListener('keydown', authKeyHandler);
}

function hideAuthModal() {
  const m = document.getElementById('authModal');
  if (m) m.classList.remove('show');
  document.removeEventListener('keydown', authKeyHandler);
}

function authKeyHandler(e){
  if (e.key === 'Escape') hideAuthModal();
  else if (e.key === 'Enter' && e.target.closest && e.target.closest('.auth-box')) {
    e.preventDefault();
    doAuth();
  }
}

function switchAuthTab(mode) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? '登入' : '註冊';
  document.getElementById('authSubmitBtn').dataset.mode = mode;
  document.getElementById('authMsg').textContent = '';
}

async function doAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const pwd = document.getElementById('authPwd').value;
  const mode = document.getElementById('authSubmitBtn').dataset.mode;
  const msg = document.getElementById('authMsg');
  if (!email || !pwd) { msg.textContent = '請填寫 Email 和密碼'; return; }
  if (pwd.length < 6) { msg.textContent = '密碼至少6位'; return; }
  if (!sb) { msg.textContent = '系統未就緒，請稍後再試'; return; }

  msg.textContent = '處理中...';
  let result;
  if (mode === 'signup') {
    result = await sb.auth.signUp({ email, password: pwd });
  } else {
    result = await sb.auth.signInWithPassword({ email, password: pwd });
  }

  if (result.error) {
    msg.textContent = result.error.message;
  } else {
    msg.textContent = mode === 'signup' ? '註冊成功！請查收驗證信' : '登入成功！';
    if (mode === 'login') setTimeout(hideAuthModal, 500);
  }
}

// ── 付費牆工具 ──
function maskValue(v) {
  if (isPro() || isLoggedIn()) return String(v);
  return '<span class="masked">●●●●</span>';
}

// ── 啟動：初始化後立即觸發 onAuthReady ──
async function boot() {
  const ok = await initSupabase();
  if (ok && typeof onAuthReady === 'function') onAuthReady();
}
document.addEventListener('DOMContentLoaded', boot);
