# 對外公開版社團介紹（獨立站）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `intro-public/`——一個與內網不同網址、完全分離的純靜態公開翻頁書頁面，供官方 LINE 連結；內網零改動。

**Architecture:** `intro-public/index.html` 為手寫、自包覆的翻頁書頁（無導覽列、無內網連結），用 `page-flip` module build（自包覆 ESM）原生 `import`。頁面清單從注入在 `#intro-fallback` 的整頁圖推導（既是 no-JS 退路、也是資料來源）。`scripts/build-intro-images.mjs` 擴充成把圖片＋page-flip 函式庫同步到 `intro-public/`，並注入 fallback 清單。第二個 Cloudflare Pages 專案（輸出目錄 `intro-public`、無 build）部署成公開網址。

**Tech Stack:** 原生 HTML/CSS/JS、`page-flip`（StPageFlip，module build，自站 host）、Node 轉檔腳本、Cloudflare Pages。

**設計來源：** `docs/superpowers/specs/2026-06-28-public-intro-site-design.md`

## Global Constraints

- **不在程式碼內嵌 `//KyymmddX` 行內 tag**（本網頁專案豁免）；程式碼乾淨。
- **配色**沿用竹綠（`--brand` #1F7A4D 等）；公開站自帶一份精簡 CSS 變數（無 `global.css`）。
- **隔離鐵則**：`intro-public/` 內**不得出現任何內網網址或連到內網的連結**（無 `workers.dev`、無 Header/Footer/nav）。
- **單頁 portrait**：`page-flip` 設 `minWidth:1000`（台寬 < 2×minWidth 必為 portrait）＋ CSS 把套件寫在台上的 inline `min-width` 以 `!important` 蓋成 0；`[hidden]{display:none!important}` 讓隱藏勝出。沿用 `/intro` 既驗證之做法。
- **page-flip 用 module build**：`node_modules/page-flip/dist/js/page-flip.module.js`（已確認 `export{… as PageFlip}`、無 bare import，可原生 `import`）。
- **Commit**：訊息 `KyymmddX [JimeiGuoyue] 英文標題.`＋空行＋`Release Note:`（a/b/c）。沿用本 session「做完驗證直接 commit、訊息貼給使用者看」。序號續編（上一個為 `K260628I`，spec+plan＝`J`，Task 1＝`K`、Task 2＝`L`）。

---

### Task 1: 公開站頁面 `intro-public/index.html` ＋ `build:intro` 同步/注入

**Files:**
- Create: `intro-public/index.html`
- Modify: `scripts/build-intro-images.mjs`（在現有產圖流程後追加「同步到 intro-public ＋注入 fallback」）
- Create（產出物，由腳本生成）：`intro-public/page-01.jpg … page-23.jpg`、`thumb-01.jpg … thumb-23.jpg`、`intro-public/page-flip.module.js`

**Interfaces:**
- Consumes: `public/intro/page-*.jpg`／`thumb-*.jpg`（由現有 `build:intro` 產生）；`node_modules/page-flip/dist/js/page-flip.module.js`。
- Produces: 公開可部署的 `intro-public/`（靜態）。

- [ ] **Step 1: 建立 `intro-public/index.html`**

Create `intro-public/index.html`（fallback 區先留空 markers，由 Step 2 的腳本注入）：

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>集美國小國樂團 介紹</title>
  <meta name="description" content="集美國小國樂團介紹——零基礎也能加入，吹管、拉弦、彈撥、揚打四大組別，一起奏響耀眼樂章。" />
  <link rel="icon" href="./thumb-01.jpg" />
  <!-- 連結預覽（LINE/Messenger）。部署後把網址換成你的 *.pages.dev 絕對網址（見 go-live 清單） -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="集美國小國樂團" />
  <meta property="og:title" content="集美國小國樂團 介紹" />
  <meta property="og:description" content="零基礎也能加入！吹管、拉弦、彈撥、揚打四大組別，邀請熱愛音樂的孩子一起加入。" />
  <meta property="og:url" content="https://jimei-guoyue-intro.pages.dev/" />
  <meta property="og:image" content="https://jimei-guoyue-intro.pages.dev/page-01.jpg" />
  <meta property="og:locale" content="zh_TW" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="集美國小國樂團 介紹" />
  <meta name="twitter:image" content="https://jimei-guoyue-intro.pages.dev/page-01.jpg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    :root{--brand:#1F7A4D;--brand-dark:#185C3A;--ink:#1C1C1C;--gold:#C8A45C;--paper:#F5EFE1;--paper-card:#FFFDF7;--text:#2B2B2B;--muted:#6B6258;--line:#E7DDC7}
    *{box-sizing:border-box}
    html{font-family:"Noto Sans TC",system-ui,sans-serif;color:var(--text);background:var(--paper);line-height:1.7}
    body{margin:0;min-height:100vh}
    .wrap{width:100%;max-width:1000px;margin:0 auto;padding:1.5rem 1.25rem}
    h1{font-family:"Noto Serif TC","Noto Sans TC",serif;color:var(--ink);font-size:1.8rem;margin:.2rem 0 .4rem}
    .muted{color:var(--muted)}
    [hidden]{display:none!important}
    .flip-frame{margin:1rem auto 0;max-width:1040px}
    .intro-controls{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.7rem}
    .intro-controls .spacer{flex:1 1 auto}
    .btn-ghost{background:var(--paper-card);color:var(--brand);border:1px solid var(--line);padding:.35rem .8rem;font-size:.9rem;cursor:pointer;border-radius:999px}
    .btn-ghost:hover{background:var(--brand);color:#fff}
    .btn-ghost:disabled{opacity:.4;cursor:default;background:var(--paper-card);color:var(--muted)}
    .page-label{font-weight:700;color:var(--ink);min-width:4.5rem;text-align:center}
    .flip-stage{width:100%;max-width:1400px;margin:0 auto;min-width:0!important;overflow:hidden}
    .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem;margin-top:1rem;padding:1rem;background:var(--paper-card);border:1px solid var(--line);border-radius:12px}
    .thumb{padding:0;border:2px solid transparent;border-radius:6px;background:none;cursor:pointer;line-height:0;overflow:hidden}
    .thumb img{width:100%;height:auto;display:block}
    .thumb:hover{border-color:var(--gold)}
    .thumb.is-current{border-color:var(--brand)}
    .intro-fallback{display:flex;flex-direction:column;align-items:center;gap:1rem;margin-top:1rem}
    .intro-fallback img{width:100%;max-width:1000px;height:auto;border:1px solid var(--line);border-radius:8px}
    .zoom-overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.92);display:flex}
    .zoom-scroll{width:100%;height:100%;overflow:auto;touch-action:pinch-zoom;display:flex}
    #zoom-img{margin:auto;width:1400px;max-width:96vw;height:auto;cursor:zoom-in}
    #zoom-img.is-2x{max-width:none;width:1900px;cursor:zoom-out}
    .zoom-close{position:fixed;top:.8rem;right:1rem;z-index:2001;width:2.4rem;height:2.4rem;border-radius:999px;border:none;background:rgba(255,255,255,.9);color:var(--ink);font-size:1.1rem;cursor:pointer}
    #flip-frame:fullscreen{background:var(--paper);display:flex;flex-direction:column;justify-content:center;padding:1rem;max-width:none}
    #flip-frame:fullscreen .flip-stage{max-width:min(95vw,1400px)}
    .flip-frame.fill-viewport{position:fixed;inset:0;z-index:1500;background:var(--paper);max-width:none;display:flex;flex-direction:column;justify-content:center;padding:1rem;overflow:auto}
    .flip-frame.fill-viewport .flip-stage{max-width:min(95vw,1400px)}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>社團介紹</h1>
    <p class="muted">翻閱集美國小國樂團介紹。手機可左右滑動翻頁。</p>

    <div class="flip-frame" id="flip-frame">
      <div class="intro-controls" id="intro-controls" hidden>
        <button class="btn-ghost" id="btn-prev" type="button">◀ 上一頁</button>
        <span class="page-label" id="page-label">1 / 1</span>
        <button class="btn-ghost" id="btn-next" type="button">下一頁 ▶</button>
        <span class="spacer"></span>
        <button class="btn-ghost" id="btn-thumbs" type="button">縮圖</button>
        <button class="btn-ghost" id="btn-zoom" type="button">放大</button>
        <button class="btn-ghost" id="btn-fs" type="button">全螢幕</button>
      </div>
      <div class="flip-stage" id="flip-stage"></div>
    </div>

    <div class="thumbs" id="thumbs" hidden></div>

    <div class="intro-fallback" id="intro-fallback">
      <!--FALLBACK_START--><!--FALLBACK_END-->
    </div>

    <div class="zoom-overlay" id="zoom-overlay" hidden>
      <button class="zoom-close" id="zoom-close" type="button" aria-label="關閉放大">✕</button>
      <div class="zoom-scroll"><img id="zoom-img" alt="" /></div>
    </div>
  </div>

  <script type="module">
    import { PageFlip } from './page-flip.module.js';

    const $ = (id) => document.getElementById(id);
    const stage = $('flip-stage');
    const frame = $('flip-frame');
    const controls = $('intro-controls');
    const fallback = $('intro-fallback');
    const label = $('page-label');
    const btnPrev = $('btn-prev');
    const btnNext = $('btn-next');
    const btnThumbs = $('btn-thumbs');
    const btnZoom = $('btn-zoom');
    const btnFs = $('btn-fs');
    const thumbsPanel = $('thumbs');
    const zoomOverlay = $('zoom-overlay');
    const zoomImg = $('zoom-img');
    const zoomClose = $('zoom-close');

    // 頁面來源＝注入在 #intro-fallback 的整頁圖（同時是 no-JS 退路）
    const srcs = [...fallback.querySelectorAll('img')].map((im) => im.getAttribute('src'));
    const TOTAL = srcs.length;
    const thumbOf = (s) => s.replace('page-', 'thumb-');
    const pageLabel = (c, t) => `${c} / ${t}`;

    // 建縮圖面板（純自家路徑、非外部輸入）
    thumbsPanel.innerHTML = srcs
      .map((s, i) => `<button class="thumb" type="button" data-index="${i}" aria-label="社團介紹 第 ${i + 1} 頁"><img src="${thumbOf(s)}" alt="社團介紹 第 ${i + 1} 頁" loading="lazy" /></button>`)
      .join('');

    const flip = new PageFlip(stage, {
      width: 1000, height: 563, size: 'stretch',
      minWidth: 1000, maxWidth: 1400, minHeight: 180, maxHeight: 788,
      maxShadowOpacity: 0.5, showCover: true, usePortrait: true, mobileScrollSupport: true,
    });
    flip.loadFromImages(srcs);

    const current = () => flip.getCurrentPageIndex();
    function syncUI() {
      const idx = current();
      label.textContent = pageLabel(idx + 1, TOTAL);
      btnPrev.disabled = idx <= 0;
      btnNext.disabled = idx >= TOTAL - 1;
      thumbsPanel.querySelectorAll('.thumb').forEach((t, i) => t.classList.toggle('is-current', i === idx));
    }
    flip.on('init', () => { controls.hidden = false; fallback.hidden = true; syncUI(); });
    flip.on('flip', syncUI);

    btnPrev.addEventListener('click', () => flip.flipPrev());
    btnNext.addEventListener('click', () => flip.flipNext());
    btnThumbs.addEventListener('click', () => { thumbsPanel.hidden = !thumbsPanel.hidden; });
    thumbsPanel.querySelectorAll('.thumb').forEach((t) => {
      t.addEventListener('click', () => { flip.flip(Number(t.dataset.index)); thumbsPanel.hidden = true; });
    });

    function openZoom() { zoomImg.src = srcs[current()]; zoomImg.classList.remove('is-2x'); zoomOverlay.hidden = false; document.body.style.overflow = 'hidden'; }
    function closeZoom() { zoomOverlay.hidden = true; document.body.style.overflow = ''; }
    btnZoom.addEventListener('click', openZoom);
    zoomClose.addEventListener('click', closeZoom);
    zoomOverlay.addEventListener('click', (e) => { if (e.target === zoomOverlay) closeZoom(); });
    zoomImg.addEventListener('click', () => zoomImg.classList.toggle('is-2x'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !zoomOverlay.hidden) closeZoom(); });

    const canFs = !!(frame.requestFullscreen && document.exitFullscreen);
    btnFs.addEventListener('click', () => {
      if (canFs) { if (!document.fullscreenElement) frame.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
      else { frame.classList.toggle('fill-viewport'); setTimeout(() => window.dispatchEvent(new Event('resize')), 120); }
    });
    document.addEventListener('fullscreenchange', () => { setTimeout(() => window.dispatchEvent(new Event('resize')), 120); });
  </script>
</body>
</html>
```

- [ ] **Step 2: 擴充 `build-intro-images.mjs`（同步＋注入）**

把 `scripts/build-intro-images.mjs` 最上方的 fs import 改成包含複製/讀寫：

```js
import { mkdirSync, readdirSync, renameSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
```

在檔尾「`console.log(...dropped blank source pages...)`」**那行之後**，追加：

```js

// ── 同步到對外公開站 intro-public/（與內網不同網域，供官方 LINE）──
const pubDir = join(root, 'intro-public');
mkdirSync(pubDir, { recursive: true });

// 清掉舊圖，避免換版後殘留多餘頁
for (const f of readdirSync(pubDir)) {
  if (/^(page|thumb)-\d+\.jpg$/.test(f)) rmSync(join(pubDir, f));
}

// 複製整頁圖＋縮圖
for (const f of readdirSync(outDir)) {
  if (/^(page|thumb)-\d+\.jpg$/.test(f)) copyFileSync(join(outDir, f), join(pubDir, f));
}

// 複製 page-flip 函式庫（module build，自站 host）
copyFileSync(
  join(root, 'node_modules', 'page-flip', 'dist', 'js', 'page-flip.module.js'),
  join(pubDir, 'page-flip.module.js'),
);

// 把整頁圖 <img> 清單注入 index.html 的 fallback markers 之間（no-JS 退路＋前端資料來源）
const finalPages = readdirSync(pubDir).filter((f) => /^page-\d+\.jpg$/.test(f)).sort();
const fallbackHtml = finalPages
  .map((f, i) => `      <img src="./${f}" alt="社團介紹 第 ${i + 1} 頁" loading="lazy" />`)
  .join('\n');
const htmlPath = join(pubDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8').replace(
  /<!--FALLBACK_START-->[\s\S]*?<!--FALLBACK_END-->/,
  `<!--FALLBACK_START-->\n${fallbackHtml}\n      <!--FALLBACK_END-->`,
);
writeFileSync(htmlPath, html);

console.log(`Synced ${finalPages.length} pages to intro-public/ and injected fallback list.`);
```

- [ ] **Step 3: 執行同步**

Run: `PDFTOCAIRO="C:/poppler/poppler-24.08.0/Library/bin/pdftocairo.exe" npm run build:intro`
Expected: 既有「Generated 23 pages...」後再印「Synced 23 pages to intro-public/ and injected fallback list.」。

- [ ] **Step 4: 驗證產出與隔離**

Run 並確認：
- `ls intro-public/` → 有 `index.html`、`page-flip.module.js`、`page-01..23.jpg`、`thumb-01..23.jpg`。
- `grep -c "intro/page-" intro-public/index.html` 為 0（公開站圖片路徑是 `./page-..`，非內網 `/intro/..`）。
- fallback 已注入：`grep -oE '<img src="\./page-[0-9]+\.jpg"' intro-public/index.html | wc -l` → 23。
- **隔離鐵則**：`grep -rE "workers\.dev|/announcements|/support|Header|關於我們" intro-public/index.html` → 無任何命中（確認不含內網連結）。

- [ ] **Step 5: 本機起靜態站驗證翻頁**

在 `.claude/launch.json` 的 `configurations` 陣列加一個（與既有 `jimei-web` 並列）：

```json
    { "name": "intro-public", "runtimeExecutable": "python", "runtimeArgs": ["-m", "http.server", "4322", "--directory", "intro-public"], "port": 4322 }
```

啟動該 server（preview_start `intro-public`），開 `http://localhost:4322/`，確認：
- 單頁翻頁、上一頁/下一頁、頁碼 `1 / 23 … 23 / 23`、末頁「下一頁」反灰。
- 縮圖面板開關＋點縮圖跳頁；放大開/關（Esc）；手機尺寸無水平溢出。
- DevTools console 無錯誤、無 404（page-flip.module.js 與圖片皆 200）。
- 關閉 JavaScript 重載：`#intro-fallback` 的 23 張整頁圖可完整捲動瀏覽。
（若 `python -m http.server` 不支援 `--directory`，改用 `npx --yes serve intro-public -l 4322`。）

- [ ] **Step 6: Commit**

Stage：`intro-public/`（含 `index.html`、`page-flip.module.js`、23＋23 圖）、`scripts/build-intro-images.mjs`
英文標題：`Add isolated public intro flipbook site under intro-public.`（如 `K260628K`）。直接 commit、訊息貼給使用者看。

---

### Task 2: 上線操作清單（go-live checklist）

**Files:**
- Create: `docs/superpowers/plans/2026-06-28-public-intro-go-live-checklist.md`

**Interfaces:**
- Consumes: 已 commit 的 `intro-public/`。
- Produces: 給使用者的一次性 Cloudflare Pages 設定步驟。

- [ ] **Step 1: 撰寫清單**

Create `docs/superpowers/plans/2026-06-28-public-intro-go-live-checklist.md`：

````markdown
# 對外公開版介紹 上線清單（一次性）

對應設計：`docs/superpowers/specs/2026-06-28-public-intro-site-design.md`。
目標：把 `intro-public/` 部署成一個**與內網不同網址**的公開站，放官方 LINE。

## 前置
- [ ] 確認最新圖片：`PDFTOCAIRO="C:/poppler/poppler-24.08.0/Library/bin/pdftocairo.exe" npm run build:intro`（兩處同步、注入 fallback）。
- [ ] GitHub Desktop **Push**，讓 repo 含最新 `intro-public/`。

## 建立第二個 Cloudflare Pages 專案
- [ ] Cloudflare 儀表板 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
- [ ] 選同一個 GitHub repo（集美網站）。
- [ ] 設定：
  - Production branch：`main`
  - Framework preset：**None**
  - Build command：**留空**
  - Build output directory：**`intro-public`**
- [ ] **Save and Deploy** → 取得網址 `https://<專案名>.pages.dev`（例：`jimei-guoyue-intro.pages.dev`）。

## 修正連結預覽網址（讓 LINE 卡片正確）
- [ ] 若專案名 ≠ `jimei-guoyue-intro`，把 `intro-public/index.html` 內 4 處絕對網址（`og:url`、`og:image`、`twitter:image`，預設 `https://jimei-guoyue-intro.pages.dev/...`）改成你的實際 `*.pages.dev`。
- [ ] GitHub Desktop **Push**（Pages 會自動重佈）。

## 放上官方 LINE
- [ ] 把 `https://<專案名>.pages.dev` 貼到官方 LINE。
- [ ] 用手機點開確認可翻頁、預覽卡片顯示封面＋標題。
- [ ] ⚠️ LINE 對網址預覽有快取：若卡片仍是舊的，網址後加沒貼過的參數（如 `?v=2`）或等快取過期。

## 驗證隔離
- [ ] 在公開站上**找不到也點不到**任何內網頁面（無導覽列、無內網網址）。
- [ ] 內網站維持不變：`jimei-guoyue-web.kuan-lin.workers.dev` 照舊，`/intro` 與「關於我們」入口卡仍在。

## 日後維護
- 換新版介紹：替換 `Reference/集美國小國樂介紹.pdf`（空白頁清單見 `scripts/build-intro-images.mjs` 的 `DROP`）→ `npm run build:intro` → Push。內網與公開站會各自自動更新。
````

- [ ] **Step 2: Commit**

Stage：`docs/superpowers/plans/2026-06-28-public-intro-go-live-checklist.md`
英文標題：`Add go-live checklist for the public intro site.`（如 `K260628L`）。直接 commit。

---

## 驗收（全部完成後）

- `intro-public/` 為自包覆靜態站：本機 `http://localhost:4322/` 翻頁／縮圖／放大／全螢幕／手機滑動／no-JS 退路皆正常。
- `intro-public/index.html` 不含任何內網網址或連結（隔離鐵則）。
- `npm run build:intro` 後，`public/intro/` 與 `intro-public/` 圖片一致（23 頁），且 `index.html` 的 fallback 為 23 張。
- 內網 `npm run build` 不變、`dist/` 不含 `intro-public/`。
- go-live 清單可讓使用者獨力完成第二個 Cloudflare Pages 部署。

## 不做（YAGNI，沿用 spec §11）

內網不加登入；不獨立第二個 git repo；公開站不放 PDF 下載、不接任何內網資料；不自動化 Cloudflare 專案建立。
