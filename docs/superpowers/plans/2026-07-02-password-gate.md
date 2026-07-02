# 內網共用密碼閘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為內網主站加一道全團共用密碼的入口閘（Worker gate，cookie 記住 30 天），並補 robots.txt／noindex 基線。

**Architecture:** 主站從「純靜態資產 Worker」升級為「Worker script＋靜態資產」：repo 根目錄加 `wrangler.jsonc`（`run_worker_first: true`），每個請求先進 `worker/index.js`——cookie 驗證通過走 `env.ASSETS.fetch()` 回靜態資產，否則回內嵌的品牌密碼頁（HTTP 200＋OG meta，LINE 預覽卡片不變）。純邏輯（token 簽發／驗證、cookie 解析、redirect 淨化、密碼頁模板）拆成可被 vitest 測的模組。

**Tech Stack:** Cloudflare Workers（Web Crypto HMAC-SHA256）、Astro 7 靜態產出（不動）、vitest 4（零設定，預設掃 `**/*.test.js`）、wrangler（`npx` 臨時執行，與 intro 站同模式、不加依賴）。

**Spec:** `docs/superpowers/specs/2026-07-02-password-gate-design.md`

## Global Constraints

- Node `>=22.12.0`（`package.json` engines；global `crypto.subtle` 可用，vitest 測試不需 polyfill）。
- ⚠️ 本專案是網頁專案，**程式碼內不加 `KyymmddX` 行內 tag**；只有 commit 訊息用 KyymmddX 格式（`K<執行當日yymmdd><當日下一個序號字母> [JimeiGuoyue] <英文標題>.`），body 末尾空一行附 `Release Note:`（a/b/c 三點、PM 視角）。
- ⚠️ **每個 `git commit` 前必須先讓使用者確認 ok** 才能執行；使用者可要求合併多個 task 為單一 commit。
- cookie 效期定案 **30 天**（使用者決定「每月輸入一次」）。
- 密碼頁固定文案：標題「集美國小國樂團」、說明「請輸入樂團密碼（見 LINE 群組公告）」、錯誤「密碼不正確，請再試一次」、按鈕「進入網站」；`lang="zh-Hant"`。
- 密碼頁未登入回應一律 **HTTP 200**（非 401）＋`Cache-Control: no-store`＋`X-Robots-Tag: noindex`——LINE 等聊天 App 預覽爬蟲對非 2xx 可能不解析 OG meta。
- 免登入放行清單（僅此五路徑）：`/logo.png`、`/favicon.ico`、`/favicon.png`、`/apple-touch-icon.png`、`/robots.txt`。
- **不動** `intro-public/`（對外公開站）、不動任何資料流（Calendar API／published CSV／Apps Script）、不動 `src/lib/` 既有模組。
- secrets 一律不進 repo：正式值走 Cloudflare dashboard runtime secrets；本機開發用 `.dev.vars`（加入 `.gitignore`）。

## File Structure

| 檔案 | 動作 | 職責 |
|---|---|---|
| `worker/auth.js` | Create | 純函式：HMAC token 簽發／驗證、cookie 解析、redirect 淨化 |
| `worker/auth.test.js` | Create | 上述純函式的 vitest 測試 |
| `worker/login-page.js` | Create | 密碼頁 HTML 模板（品牌視覺＋OG meta＋跳脫） |
| `worker/login-page.test.js` | Create | 模板的 vitest 測試 |
| `worker/index.js` | Create | Worker fetch handler：放行清單→登入 POST→cookie 驗證→ASSETS |
| `wrangler.jsonc` | Create | Worker 部署設定（name 沿用 `jimei-guoyue-web`） |
| `.dev.vars` | Create（不 commit） | 本機開發 secrets |
| `.gitignore` | Modify | 加 `.dev.vars` |
| `public/robots.txt` | Create | `Disallow: /` 基線 |
| `src/layouts/Layout.astro` | Modify | head 加 noindex meta |
| `docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md` | Create | 上線操作清單（Cloudflare 一次性設定） |
| `CLAUDE.md` | Modify | 部署段＋目前狀態補密碼閘說明 |

---

### Task 1: `worker/auth.js` 純函式（TDD）

**Files:**
- Create: `worker/auth.js`
- Test: `worker/auth.test.js`

**Interfaces:**
- Consumes: 無（只用 global `crypto.subtle`、`TextEncoder`）
- Produces（Task 3 依賴，簽名必須一字不差）:
  - `async createToken(secret: string, expiresMs: number): Promise<string>` — 回 `"<expiresMs>.<hmacHex>"`
  - `async verifyToken(secret: string, token: unknown, nowMs: number): Promise<boolean>`
  - `getCookie(header: string | null, name: string): string | null`
  - `sanitizeRedirect(value: unknown): string` — 非站內相對路徑一律回 `'/'`

- [ ] **Step 1: 寫失敗測試**

建立 `worker/auth.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { createToken, verifyToken, getCookie, sanitizeRedirect } from './auth.js';

const SECRET = 'test-secret';
const NOW = 1_700_000_000_000;

describe('createToken / verifyToken', () => {
  it('accepts a fresh token signed with the same secret', async () => {
    const token = await createToken(SECRET, NOW + 1000);
    expect(await verifyToken(SECRET, token, NOW)).toBe(true);
  });

  it('rejects an expired token', async () => {
    const token = await createToken(SECRET, NOW - 1);
    expect(await verifyToken(SECRET, token, NOW)).toBe(false);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createToken('other-secret', NOW + 1000);
    expect(await verifyToken(SECRET, token, NOW)).toBe(false);
  });

  it('rejects a token whose expiry was tampered with', async () => {
    const token = await createToken(SECRET, NOW + 1000);
    const sig = token.slice(token.indexOf('.') + 1);
    expect(await verifyToken(SECRET, `${NOW + 999_999_999}.${sig}`, NOW)).toBe(false);
  });

  it('rejects malformed tokens', async () => {
    for (const bad of [null, undefined, '', 'no-dot', '.abc', '123.', '123.zz', 'abc.def', '12.3.deadbeef']) {
      expect(await verifyToken(SECRET, bad, NOW)).toBe(false);
    }
  });
});

describe('getCookie', () => {
  it('finds the named cookie among several', () => {
    expect(getCookie('a=1; jimei_gate=tok123; b=2', 'jimei_gate')).toBe('tok123');
  });

  it('does not match a cookie whose name merely ends with the target', () => {
    expect(getCookie('xjimei_gate=evil', 'jimei_gate')).toBe(null);
  });

  it('returns null when absent or header missing', () => {
    expect(getCookie('a=1', 'jimei_gate')).toBe(null);
    expect(getCookie(null, 'jimei_gate')).toBe(null);
    expect(getCookie('', 'jimei_gate')).toBe(null);
  });
});

describe('sanitizeRedirect', () => {
  it('keeps same-site relative paths (with query)', () => {
    expect(sanitizeRedirect('/announcements?x=1')).toBe('/announcements?x=1');
    expect(sanitizeRedirect('/')).toBe('/');
  });

  it('falls back to / for absolute URLs, protocol-relative URLs, or junk', () => {
    for (const bad of ['https://evil.com', '//evil.com', 'javascript:alert(1)', '', null, undefined, 'calendar']) {
      expect(sanitizeRedirect(bad)).toBe('/');
    }
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL——`worker/auth.js` 不存在（Cannot find module / Failed to load）。

- [ ] **Step 3: 最小實作**

建立 `worker/auth.js`：

```js
// 密碼閘純邏輯：token 簽發／驗證與輸入淨化。
// 只用 Web Crypto（Cloudflare Workers 與 Node 22+ 皆有 global crypto），無任何依賴。
const encoder = new TextEncoder();

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** 簽發 `${expiresMs}.${hmacHex}`；expiresMs 為毫秒時間戳。 */
export async function createToken(secret, expiresMs) {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(String(expiresMs)));
  return `${expiresMs}.${bufToHex(sig)}`;
}

/** token 格式正確、未過期（相對 nowMs）且簽章相符才回 true。 */
export async function verifyToken(secret, token, nowMs) {
  if (typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  if (!/^\d+$/.test(expStr) || Number(expStr) <= nowMs) return false;
  const sig = hexToBuf(token.slice(dot + 1));
  if (!sig) return false;
  const key = await importKey(secret);
  return crypto.subtle.verify('HMAC', key, sig, encoder.encode(expStr));
}

/** 從 Cookie header 取指定名稱的值；找不到回 null。 */
export function getCookie(header, name) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** 只接受站內相對路徑（防 open redirect），其餘一律回首頁。 */
export function sanitizeRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}
```

註：`'12.3.deadbeef'` 會被 `/^\d+$/` 擋下（`expStr` 為 `12`，其後的 `3.deadbeef` 不是合法 hex → `hexToBuf` 回 null）——兩道防線任一擋下即可。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS（既有 `src/lib/*.test.js` 也全綠，確認沒弄壞現有測試）。

- [ ] **Step 5: Commit（先請使用者確認）**

```
K<執行日><序號> [JimeiGuoyue] Add password gate token and cookie helpers.

- Add worker/auth.js pure helpers: HMAC-SHA256 signed expiry token (createToken/verifyToken), cookie header parsing (getCookie), and same-site redirect sanitizing (sanitizeRedirect) using Web Crypto only.
- Add worker/auth.test.js covering fresh/expired/tampered/wrong-secret/malformed tokens, cookie parsing edge cases, and open-redirect fallbacks.

Release Note:
a. 無使用者可見變化（內部零件，密碼保護功能於後續更新一併上線）。
b. 網站將加上全團共用密碼的入口保護，此為第一步的基礎元件。
c. 先完成「記住已輸入密碼的裝置 30 天」所需的簽章與驗證邏輯並通過自動測試。
```

---

### Task 2: `worker/login-page.js` 密碼頁模板（TDD）

**Files:**
- Create: `worker/login-page.js`
- Test: `worker/login-page.test.js`

**Interfaces:**
- Consumes: 無
- Produces（Task 3 依賴）:
  - `renderLoginPage({ redirectTo: string, error: string | null, origin: string }): string` — 回完整 HTML 文件字串

- [ ] **Step 1: 寫失敗測試**

建立 `worker/login-page.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { renderLoginPage } from './login-page.js';

const base = { redirectTo: '/', error: null, origin: 'https://example.com' };

describe('renderLoginPage', () => {
  it('includes OG meta with an absolute logo URL so LINE link previews stay intact', () => {
    const html = renderLoginPage(base);
    expect(html).toContain('property="og:title" content="集美國小國樂團"');
    expect(html).toContain('property="og:image" content="https://example.com/logo.png"');
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).toContain('lang="zh-Hant"');
  });

  it('posts to the gate login path and carries the redirect target', () => {
    const html = renderLoginPage({ ...base, redirectTo: '/calendar' });
    expect(html).toContain('action="/__gate/login"');
    expect(html).toContain('name="redirect" value="/calendar"');
    expect(html).toContain('請輸入樂團密碼');
  });

  it('shows the error message only when provided', () => {
    expect(renderLoginPage(base)).not.toContain('gate-error');
    expect(renderLoginPage({ ...base, error: '密碼不正確，請再試一次' })).toContain('密碼不正確，請再試一次');
  });

  it('escapes the redirect value so it cannot break out of the attribute', () => {
    const html = renderLoginPage({ ...base, redirectTo: '/"><script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('value="/&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL——`worker/login-page.js` 不存在。

- [ ] **Step 3: 最小實作**

建立 `worker/login-page.js`（品牌色抄自 `src/styles/global.css` 的 `:root` token；密碼頁刻意不載 Google Fonts 保持輕量，系統字體即可）：

```js
// 密碼閘登入頁：自包覆 HTML（worker 內嵌，不經 Astro build）。
// head 帶與內頁一致的 OG meta——LINE 等聊天 App 的預覽爬蟲拿到的就是這頁，
// 卡片因此維持「團徽＋集美國小國樂團」的樣子。
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLoginPage({ redirectTo, error, origin }) {
  const ogImage = `${origin}/logo.png`;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>集美國小國樂團</title>
<meta name="description" content="集美國小國樂團資訊">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="集美國小國樂團">
<meta property="og:title" content="集美國小國樂團">
<meta property="og:description" content="集美國小國樂團資訊">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="zh_TW">
<meta name="twitter:card" content="summary">
<style>
  :root{--brand:#1F7A4D;--brand-dark:#185C3A;--ink:#3b3322;--muted:#6b5f44;--paper:#FBF6EC;--seal:#B23A30;--line:#ece0c8}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--paper);color:var(--ink);font-family:"Noto Sans TC",system-ui,sans-serif;line-height:1.7;padding:24px}
  .gate-card{background:#fff;border-radius:16px;box-shadow:0 4px 16px -10px rgba(120,90,40,.4);padding:36px 28px;width:min(92vw,380px);text-align:center}
  .gate-card img{width:72px;height:72px;object-fit:contain}
  h1{font-size:22px;color:var(--ink);margin:12px 0 4px}
  p{margin:0 0 20px;font-size:14px;color:var(--muted)}
  .gate-error{color:var(--seal);font-weight:600;margin:0 0 12px}
  input[type=password]{width:100%;padding:12px 14px;font-size:16px;border:1px solid var(--line);border-radius:10px;margin-bottom:12px}
  input[type=password]:focus{outline:2px solid var(--brand);border-color:var(--brand)}
  button{width:100%;background:var(--brand);color:#fff;border:0;border-radius:999px;padding:12px;font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:var(--brand-dark)}
</style>
</head>
<body>
<div class="gate-card">
  <img src="/logo.png" alt="集美國小國樂團團徽">
  <h1>集美國小國樂團</h1>
  <p>請輸入樂團密碼（見 LINE 群組公告）</p>
  ${error ? `<p class="gate-error">${esc(error)}</p>` : ''}
  <form method="post" action="/__gate/login">
    <input type="hidden" name="redirect" value="${esc(redirectTo)}">
    <input type="password" name="password" placeholder="樂團密碼" autocomplete="current-password" autofocus required>
    <button type="submit">進入網站</button>
  </form>
</div>
</body>
</html>`;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS（全綠）。

- [ ] **Step 5: Commit（先請使用者確認）**

```
K<執行日><序號> [JimeiGuoyue] Add password gate login page template.

- Add worker/login-page.js: self-contained branded login page (paper/bamboo-green tokens, logo, zh-Hant copy) with full OG meta pointing at an absolute /logo.png URL so LINE link preview cards stay identical to the site's.
- Escape redirect/error values before embedding into HTML; page carries noindex and posts to /__gate/login with a hidden redirect field.
- Add worker/login-page.test.js covering OG meta, form wiring, conditional error message, and attribute escaping.

Release Note:
a. 無使用者可見變化（內部零件，密碼保護功能於後續更新一併上線）。
b. 準備家長第一次進站會看到的「請輸入樂團密碼」畫面。
c. 完成與網站同風格的密碼輸入頁，並確保在 LINE 分享連結時預覽小卡維持團徽與樂團名稱。
```

---

### Task 3: Worker gate 本體＋wrangler 設定（整合）

**Files:**
- Create: `worker/index.js`
- Create: `wrangler.jsonc`
- Create: `.dev.vars`（**不 commit**）
- Modify: `.gitignore`（`.wrangler/` 區塊後加 `.dev.vars`）

**Interfaces:**
- Consumes: Task 1 的 `createToken/verifyToken/getCookie/sanitizeRedirect`、Task 2 的 `renderLoginPage`
- Produces: Cloudflare Worker `fetch` handler；runtime bindings `env.SITE_PASSWORD`、`env.COOKIE_SECRET`、`env.ASSETS`

- [ ] **Step 1: 建立 `worker/index.js`**

```js
// 內網密碼閘：run_worker_first 讓所有請求先進這裡。
// cookie 有效 → 回靜態資產；無效 → 回密碼頁（HTTP 200，帶 OG meta 保 LINE 預覽）。
// secrets（dashboard 設定）：SITE_PASSWORD＝全團共用密碼、COOKIE_SECRET＝cookie 簽章金鑰。
import { createToken, verifyToken, getCookie, sanitizeRedirect } from './auth.js';
import { renderLoginPage } from './login-page.js';

const COOKIE_NAME = 'jimei_gate';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 天：使用者定案「每月輸入一次」
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
        return handleLogin(request, env, url);
      }
      const token = getCookie(request.headers.get('Cookie'), COOKIE_NAME);
      if (token && (await verifyToken(env.COOKIE_SECRET, token, Date.now()))) {
        return env.ASSETS.fetch(request);
      }
      return gateResponse(url, url.pathname + url.search, null);
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
```

- [ ] **Step 2: 建立 `wrangler.jsonc`**

```jsonc
{
  // 主站（內網）＝密碼閘 Worker＋Astro build 出的靜態資產（dist/）。
  // Cloudflare Workers Builds：Build command = npm run build、Deploy command = npx wrangler deploy。
  // 上線前需在 dashboard 設兩個 runtime secret：SITE_PASSWORD、COOKIE_SECRET
  // （操作見 docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md）。
  "name": "jimei-guoyue-web",
  "compatibility_date": "2026-07-02",
  "main": "worker/index.js",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": true
  }
}
```

⚠️ `name` 必須是 `jimei-guoyue-web`（現有 Worker 名）——deploy 才會更新同一個 Worker、網址不變；取別的名字會生出第二個 Worker。

- [ ] **Step 3: 建立 `.dev.vars` 並加入 `.gitignore`**

`.dev.vars`（repo 根目錄，`npx wrangler dev` 會自動讀為本機 secrets）：

```
SITE_PASSWORD=test1234
COOKIE_SECRET=dev-only-cookie-secret
```

`.gitignore` 的 Wrangler 區塊改為：

```
# Wrangler 本機快取（公開站 intro-public 部署用）
.wrangler/
# Wrangler 本機 secrets（主站密碼閘開發用，正式值設在 Cloudflare dashboard）
.dev.vars
```

- [ ] **Step 4: 跑單元測試（迴歸）**

Run: `npm test`
Expected: PASS（worker 兩個測試檔＋既有 `src/lib` 測試全綠）。

- [ ] **Step 5: 本機整合驗證（wrangler dev）**

```powershell
npm run build
npx wrangler dev
```

（`wrangler dev` 本機模式不需登入 Cloudflare；首次 `npx` 會下載 wrangler。伺服器起在 http://localhost:8787。另開一個終端跑下列驗證：）

```powershell
# 1) 未登入看首頁 → 200 但內容是密碼頁
curl.exe -s http://localhost:8787/ | Select-String "請輸入樂團密碼"

# 2) 放行清單 → 拿得到檔案
curl.exe -s -o NUL -w "%{http_code}" http://localhost:8787/logo.png    # 期望 200
curl.exe -s http://localhost:8787/robots.txt                            # 期望輸出 Disallow: /（Task 4 完成後）

# 3) 錯密碼 → 密碼頁＋錯誤訊息
curl.exe -s -X POST http://localhost:8787/__gate/login --data "password=wrong&redirect=/" | Select-String "密碼不正確"

# 4) 對密碼 → 302 到 redirect 目標＋Set-Cookie
curl.exe -s -i -X POST http://localhost:8787/__gate/login --data "password=test1234&redirect=/calendar" | Select-String "302|Location|Set-Cookie"

# 5) 帶上一步 Set-Cookie 的 jimei_gate=<值> 再看首頁 → 真正的網站首頁
curl.exe -s -H "Cookie: jimei_gate=<貼上一步的值>" http://localhost:8787/ | Select-String "近期行程"

# 6) open redirect 防護：redirect=https://evil.com → Location 必須是 /
curl.exe -s -i -X POST http://localhost:8787/__gate/login --data "password=test1234&redirect=https://evil.com" | Select-String "Location"
```

瀏覽器補測：開 http://localhost:8787 → 看到品牌密碼頁 → 輸 `test1234` → 進站正常瀏覽（Chrome 允許 localhost 上的 `Secure` cookie）。

Expected: 全部符合註解中的期望值。驗完 `Ctrl+C` 關掉 wrangler dev。

- [ ] **Step 6: Commit（先請使用者確認；`.dev.vars` 不入庫）**

```bash
git add worker/index.js wrangler.jsonc .gitignore
```

```
K<執行日><序號> [JimeiGuoyue] Add worker password gate with wrangler config.

- Add worker/index.js: run_worker_first gate — allowlist (logo/favicons/robots.txt) passes through, POST /__gate/login checks SITE_PASSWORD and sets a 30-day HMAC-signed HttpOnly cookie, valid cookie serves static assets via env.ASSETS, everything else gets the branded login page (HTTP 200 + no-store + X-Robots-Tag noindex so LINE previews still parse OG meta).
- Fail-closed: any worker exception (including unset secrets) falls back to the login page; open redirect blocked via sanitizeRedirect.
- Add wrangler.jsonc reusing the existing worker name jimei-guoyue-web (same URL) with assets binding to ./dist; ignore .dev.vars for local wrangler dev secrets.

Release Note:
a. 內網原本任何拿到網址的人都能直接瀏覽。
b. 網站缺少入口保護，僅靠網址不公開。
c. 加上全團共用密碼的入口：第一次輸入後裝置記住 30 天，LINE 分享預覽小卡維持原樣（部署設定完成後生效）。
```

---

### Task 4: noindex 基線（robots.txt＋Layout meta）

**Files:**
- Create: `public/robots.txt`
- Modify: `src/layouts/Layout.astro`（head 內、`<meta name="description" ...>` 之後）

**Interfaces:**
- Consumes: 無
- Produces: 無（純靜態輸出）

- [ ] **Step 1: 建立 `public/robots.txt`**

```
User-agent: *
Disallow: /
```

- [ ] **Step 2: `Layout.astro` 加 noindex meta**

在 `src/layouts/Layout.astro` 的 `<meta name="description" content={description} />`（第 16 行）之後插入一行：

```html
    <meta name="robots" content="noindex" />
```

（內頁只有過閘後才看得到，這行是「閘被關掉或繞過時」的第二道保險；LINE 預覽爬蟲不受 noindex 影響。）

- [ ] **Step 3: build 驗證**

```powershell
npm run build
Get-Content dist/robots.txt                                  # 期望：User-agent: * / Disallow: /
Select-String -Path dist/index.html -Pattern 'name="robots" content="noindex"'   # 期望：命中 1 行
npm test                                                     # 期望：全綠
```

- [ ] **Step 4: Commit（先請使用者確認）**

```
K<執行日><序號> [JimeiGuoyue] Add robots.txt and noindex baseline.

- Add public/robots.txt (Disallow: /) and a robots noindex meta in Layout.astro so the internal site never gets indexed even if the gate is ever disabled.

Release Note:
a. 內網有機會被 Google 等搜尋引擎收錄，搜樂團名稱可能直接找到內部網站。
b. 網站先前未告知搜尋引擎「不要收錄」。
c. 加上雙重防收錄設定，搭配密碼保護後搜尋引擎完全看不到內部內容。
```

---

### Task 5: 上線 checklist＋CLAUDE.md 更新

**Files:**
- Create: `docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md`
- Modify: `CLAUDE.md`（「部署」段與「目前狀態 / 待辦」段）

**Interfaces:**
- Consumes: Task 3 的 secret 名稱（`SITE_PASSWORD`、`COOKIE_SECRET`）與 deploy 設定
- Produces: 使用者可獨立照做的上線步驟

- [ ] **Step 1: 建立 go-live checklist**

`docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md`：

```markdown
# 密碼閘上線操作清單

前置：`main` 已含密碼閘程式（wrangler.jsonc＋worker/）。整個流程約 10 分鐘；
步驟 2 push 之後到步驟 3 設好 secrets 之前，全站會顯示密碼頁且任何密碼都進不去
（fail-closed 保護），建議選離峰時段一次做完。

## 0. 事前準備
- [ ] 會長／幹部決定要公告給家長的「樂團密碼」
- [ ] 產生 COOKIE_SECRET 隨機亂碼（本機執行）：
      `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
      記下輸出（家長不會看到它，只是簽章用）

## 1. 改部署指令（一次性）
- [ ] Cloudflare dashboard → Workers & Pages → **jimei-guoyue-web** → Settings → Build
- [ ] Deploy command 改為：`npx wrangler deploy`（Build command 維持 `npm run build`）

## 2. 部署
- [ ] GitHub Desktop push（或確認 main 已含本功能）→ 等 Cloudflare build 完成
- [ ] 開 https://jimei-guoyue-web.jmes-ntpc.workers.dev → 應看到密碼頁（此刻輸什麼都進不去，正常）

## 3. 設定 secrets（此時 runtime 區已解鎖）
- [ ] 同 Worker → Settings → Variables and secrets（**runtime** 區，不是 Build 區）
- [ ] 新增 `SITE_PASSWORD`（Type: Secret）＝要公告的樂團密碼
- [ ] 新增 `COOKIE_SECRET`（Type: Secret）＝步驟 0 產生的亂碼
- [ ] 儲存後即刻生效，**不需**重新部署

## 4. 驗證
- [ ] 無痕視窗開站 → 密碼頁 → 輸錯 → 「密碼不正確」；輸對 → 進站
- [ ] 進站後首頁「近期行程」正常載入（Calendar API 不受影響）
- [ ] 公告頁、文件頁、活動支援頁資料正常
- [ ] 關掉無痕再開一般視窗 → 已登入者 30 天內不再被問
- [ ] 手機 LINE：把網址貼到與自己的聊天室 → 預覽小卡仍是團徽＋「集美國小國樂團」
      （若卡片是舊快取，網址加 `?v=4` 再貼）
- [ ] 手機 LINE 點連結 → 密碼頁 → 輸入 → 進站
- [ ] 對外介紹站 https://jimei-guoyue-intro.jmes-ntpc.workers.dev 仍可直接開（不受影響）

## 5. 公告
- [ ] LINE 群公告網站密碼與「約每月會再問一次」的說明

## 回滾（若出問題）
- [ ] revert 密碼閘的 commits → push（wrangler.jsonc 消失後 `npx wrangler deploy` 會失敗，
      需同時把 Deploy command 清回原值）；或快速止血：wrangler.jsonc 移除
      `"main"` 與 `"run_worker_first"` 兩行 → push，即回到無閘的純靜態站

## 日常維運
- 換密碼（建議每學年）：dashboard 改 `SITE_PASSWORD` → LINE 公告；已登入者最多 30 天後改用新密碼
- 緊急全員登出（密碼外流）：連 `COOKIE_SECRET` 一起換新亂碼 → 所有裝置立即要求重新輸入
```

- [ ] **Step 2: 更新 `CLAUDE.md`**

(a) 「部署」段第一條（已上線：主站網址那條）之後，加一條：

```markdown
- **內網密碼閘**：主站由 `wrangler.jsonc`＋`worker/`（`run_worker_first` 密碼閘）部署——全團共用密碼（LINE 群公告）、cookie 記住 30 天、密碼頁帶 OG meta 保 LINE 預覽；放行 logo／favicon／robots.txt。兩個 runtime secret：`SITE_PASSWORD`（共用密碼）、`COOKIE_SECRET`（簽章金鑰，換掉＝全員登出）。⚠️ Deploy command 為 `npx wrangler deploy`（非預設靜態資產部署）；本機測閘：`npm run build` 後 `npx wrangler dev`（secrets 在 `.dev.vars`，不入庫）。上線步驟見 `docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md`。
```

(b) 「目錄結構」段 `scripts/` 那行之前加：

```markdown
- `worker/` — 內網密碼閘 Worker：`index.js`（gate handler）、`auth.js`／`login-page.js`（純邏輯＋模板，各有 `*.test.js`）
```

(c) 「目前狀態 / 待辦」清單開頭（Phase 1/2 完成那條之後）加：

```markdown
- **內網密碼閘**已實作 ✓（全團共用密碼、每月輸入一次、fail-closed、noindex 基線；設計 `docs/superpowers/specs/2026-07-02-password-gate-design.md`）。⚠️ **上線待使用者操作**：改 Deploy command、設 `SITE_PASSWORD`／`COOKIE_SECRET` 兩個 runtime secret——步驟見 `docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md`。
```

- [ ] **Step 3: 最終迴歸**

```powershell
npm test        # 全綠
npm run build   # 成功
```

- [ ] **Step 4: Commit（先請使用者確認）**

```
K<執行日><序號> [JimeiGuoyue] Add password gate go-live checklist and update project docs.

- Add docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md: one-time Cloudflare steps (switch deploy command, set SITE_PASSWORD/COOKIE_SECRET runtime secrets), verification list (LINE preview, calendar API, public intro site untouched), rollback and rotation procedures.
- Update CLAUDE.md deployment/status/structure sections for the worker gate.

Release Note:
a. 幹部需要知道密碼保護如何開通與日常維護。
b. 開通需在 Cloudflare 後台做一次性設定，之前缺少中文操作說明。
c. 提供逐步上線清單（含驗證與回滾）並更新專案文件。
```

---

## 驗收清單（對照 spec）

- [ ] 未登入任何頁 → 品牌密碼頁（200＋no-store＋noindex）
- [ ] 錯密碼 → 「密碼不正確，請再試一次」；對密碼 → 302 回原目標＋30 天 cookie
- [ ] 放行五路徑免登入；JS bundle 在閘後
- [ ] open redirect 被擋（`redirect=https://evil.com` → `/`）
- [ ] fail-closed（secrets 未設＝全鎖不裸奔）
- [ ] robots.txt＋Layout noindex 進 build 產物
- [ ] `npm test` 全綠、`npm run build` 成功、intro-public 未動
- [ ] 上線 checklist 可由使用者獨立照做
