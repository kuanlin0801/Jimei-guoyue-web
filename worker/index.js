// 內網密碼閘：run_worker_first 讓所有請求先進這裡。
// cookie 有效 → 回靜態資產；無效 → 回密碼頁（HTTP 200，帶 OG meta 保 LINE 預覽）。
// secrets（dashboard 設定）：SITE_PASSWORD＝全團共用密碼、COOKIE_SECRET＝cookie 簽章金鑰。
import { createToken, verifyToken, getCookie, sanitizeRedirect } from './auth.js';
import { renderLoginPage } from './login-page.js';

const COOKIE_NAME = 'jimei_gate';
const COOKIE_MAX_AGE_SECONDS = 60 * 24 * 60 * 60; // 60 天：使用者定案「每兩個月輸入一次」
const LOGIN_PATH = '/__gate/login';
// 免登入清單：LINE 預覽要抓的 logo、瀏覽器自動請求的 favicon 三件組、robots.txt
const PUBLIC_PATHS = new Set([
  '/logo.png',
  '/favicon.ico',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/robots.txt',
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (PUBLIC_PATHS.has(url.pathname)) return env.ASSETS.fetch(request);
      if (url.pathname === LOGIN_PATH && request.method === 'POST') {
        return await handleLogin(request, env, url);
      }
      const token = getCookie(request.headers.get('Cookie'), COOKIE_NAME);
      if (token && (await verifyToken(env.COOKIE_SECRET, token, Date.now()))) {
        return env.ASSETS.fetch(request);
      }
      const target = url.pathname === LOGIN_PATH ? '/' : url.pathname + url.search;
      return gateResponse(url, target, null);
    } catch {
      // fail-closed：任何例外（含 secrets 未設）都回密碼頁，不放行
      return gateResponse(url, '/', null);
    }
  },
};

async function handleLogin(request, env, url) {
  const form = await request.formData();
  const redirectTo = sanitizeRedirect(form.get('redirect'));
  const password = form.get('password');
  if (!env.SITE_PASSWORD || password !== env.SITE_PASSWORD) {
    return gateResponse(url, redirectTo, '密碼不正確，請再試一次');
  }
  const expiresMs = Date.now() + COOKIE_MAX_AGE_SECONDS * 1000;
  const token = await createToken(env.COOKIE_SECRET, expiresMs);
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectTo,
      'Set-Cookie': `${COOKIE_NAME}=${token}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    },
  });
}

function gateResponse(url, redirectTo, error) {
  return new Response(renderLoginPage({ redirectTo, error, origin: url.origin }), {
    status: 200, // 非 2xx 會讓 LINE 預覽爬蟲放棄解析 OG meta，故回 200
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
