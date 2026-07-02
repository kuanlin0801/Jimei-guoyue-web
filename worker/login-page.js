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
  const errorStyle = error ? '.gate-error{color:var(--seal);font-weight:600;margin:0 0 12px}' : '';
  const errorMsg = error ? `<p class="gate-error">${esc(error)}</p>` : '';
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
  ${errorStyle}
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
  ${errorMsg}
  <form method="post" action="/__gate/login">
    <input type="hidden" name="redirect" value="${esc(redirectTo)}">
    <input type="password" name="password" placeholder="樂團密碼" autocomplete="current-password" autofocus required>
    <button type="submit">進入網站</button>
  </form>
</div>
</body>
</html>`;
}
