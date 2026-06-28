# 社團介紹電子書（翻頁書）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本站新增 `/intro` 頁，用 StPageFlip 把 25 頁的社團介紹 PDF 做成可翻頁的電子書（單頁翻＋縮圖瀏覽＋全螢幕＋放大），完全自己 host、不依賴外部網站。

**Architecture:** PDF 用 `pdftocairo` 一次性轉成整頁圖＋縮圖放 `public/intro/`。`/intro` 頁先 SSR 輸出 25 張圖的基礎清單（no-JS 退路），client script 再用 StPageFlip 升級成翻頁書。純邏輯（頁面清單／頁碼）抽到 `src/lib/flipbook.js` 配 vitest，其餘 DOM 膠水碼留在頁面。入口卡放「關於我們」頁。

**Tech Stack:** Astro 7、原生 HTML/CSS/JS、`page-flip`（StPageFlip，npm，打包進站不走 CDN）、`pdftocairo`（Poppler，已安裝）、vitest。

**設計來源：** `docs/superpowers/specs/2026-06-28-club-intro-flipbook-design.md`

## Global Constraints

- **Node** `>=22.12.0`；**Astro** `^7.0.0`（沿用現有 `package.json`）。
- **不在 Astro/JS 程式碼內嵌 `//KyymmddX` 行內 tag**（本網頁專案明文豁免全域 BIOS tag 規則）；程式碼保持乾淨。
- **配色**一律用 `src/styles/global.css` 的 CSS 變數（`--brand` #1F7A4D、`--gold`、`--paper`、`--paper-card`、`--ink`、`--muted`、`--line`）；可重用既有 class：`.card`、`.btn`、`.muted`、`.label`、`.container`（`max-width:1000px`）。
- **純邏輯只放 `src/lib/`** 並配 `*.test.js`（vitest）；`src/lib/` 的檔案不碰 DOM、不呼叫網路。
- **翻頁固定單頁**：StPageFlip 的單/雙頁由容器寬度決定。`.container` 已把內容壓在 ≤1000px（<2×base 1000）→ 天然單頁；全螢幕時另把翻頁台 `max-width` 壓在 1400px（仍 <2000）確保不變雙頁。
- **安全**：本頁全為站內靜態圖片、無外部 fetch、無使用者輸入、不對外部資料做 `innerHTML` → 無需 `esc()`；勿引入任何把外部字串塞進 `innerHTML` 的程式。
- **Commit 規則**：訊息用 `KyymmddX [JimeiGuoyue] 英文標題.` 格式；body 後空一行附 `Release Note:`（a/b/c 三點，PM 視角）。**每次 commit 前須先讓使用者確認**——建議每個 Task 結束時用 `/commit` 產生訊息再經使用者同意。下列各 Task 的 commit 步驟只列「要 stage 的檔案＋英文標題」，序號 `KyymmddX` 依執行當日續編（範例假設 2026-06-28，從既有 `K260628B` 續為 C/D/E/F）。

---

### Task 1: 純邏輯 `flipbook.js`（頁面清單／頁碼）

**Files:**
- Create: `src/lib/flipbook.js`
- Test: `src/lib/flipbook.test.js`

**Interfaces:**
- Consumes: 無（純函式）。
- Produces（後續 `intro.astro` 會用）：
  - `pad(n: number, width = 2): string`
  - `buildPages(count: number, opts?: { dir?: string }): Array<{ index: number, src: string, thumb: string, alt: string }>`
  - `formatPageLabel(current: number, total: number): string`

- [ ] **Step 1: 寫失敗測試**

Create `src/lib/flipbook.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { pad, buildPages, clampPage, formatPageLabel } from './flipbook.js';

describe('pad', () => {
  it('zero-pads to width 2 by default', () => {
    expect(pad(1)).toBe('01');
    expect(pad(25)).toBe('25');
  });
  it('respects an explicit width', () => {
    expect(pad(5, 3)).toBe('005');
  });
});

describe('buildPages', () => {
  it('returns one descriptor per page with padded paths and alt text', () => {
    const pages = buildPages(25);
    expect(pages).toHaveLength(25);
    expect(pages[0]).toEqual({
      index: 1,
      src: '/intro/page-01.jpg',
      thumb: '/intro/thumb-01.jpg',
      alt: '社團介紹 第 1 頁',
    });
    expect(pages[24].src).toBe('/intro/page-25.jpg');
    expect(pages[24].thumb).toBe('/intro/thumb-25.jpg');
  });
  it('honors a custom dir', () => {
    expect(buildPages(1, { dir: '/x' })[0].src).toBe('/x/page-01.jpg');
  });
  it('returns an empty array for count 0', () => {
    expect(buildPages(0)).toEqual([]);
  });
});

describe('formatPageLabel', () => {
  it('formats as "current / total"', () => {
    expect(formatPageLabel(3, 25)).toBe('3 / 25');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL（`flipbook.js` 不存在 / 函式未定義）。

- [ ] **Step 3: 實作 `flipbook.js`**

Create `src/lib/flipbook.js`:

```js
// 頁碼補零；寬度依總頁數（25 頁 → 2 位 → "01".."25"）
export function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

// 產生頁面清單；dir 預設站內 /intro，圖檔命名須與轉檔腳本一致
export function buildPages(count, { dir = '/intro' } = {}) {
  const pages = [];
  for (let i = 1; i <= count; i++) {
    const p = pad(i);
    pages.push({
      index: i,
      src: `${dir}/page-${p}.jpg`,
      thumb: `${dir}/thumb-${p}.jpg`,
      alt: `社團介紹 第 ${i} 頁`,
    });
  }
  return pages;
}

// 頁碼標籤
export function formatPageLabel(current, total) {
  return `${current} / ${total}`;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS（全部綠）。

- [ ] **Step 5: Commit**

Stage：`src/lib/flipbook.js`、`src/lib/flipbook.test.js`
英文標題：`Add flipbook page-list pure logic with tests.`（序號續編，如 `K260628C [JimeiGuoyue] ...`）。用 `/commit` 產訊息＋Release Note，經使用者確認後 commit。

---

### Task 2: PDF→圖片轉檔腳本與素材產出

**Files:**
- Create: `scripts/build-intro-images.mjs`
- Modify: `package.json`（新增 `build:intro` script）
- Create（產出物）：`public/intro/page-01.jpg … page-25.jpg`、`public/intro/thumb-01.jpg … thumb-25.jpg`

**Interfaces:**
- Consumes: `Reference/集美國小國樂介紹.pdf`（25 頁、16:9）。
- Produces: `public/intro/` 下 25 整頁圖＋25 縮圖，命名 `page-NN.jpg` / `thumb-NN.jpg`（2 位補零），供 `flipbook.js` 的 `buildPages` 對應。

- [ ] **Step 1: 寫轉檔腳本**

Create `scripts/build-intro-images.mjs`:

```js
// 把社團介紹 PDF 逐頁轉成整頁圖＋縮圖，輸出到 public/intro/
// 需要 Poppler 的 pdftocairo；若不在 PATH，設環境變數 PDFTOCAIRO 指向執行檔
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pdf = join(root, 'Reference', '集美國小國樂介紹.pdf');
const outDir = join(root, 'public', 'intro');
const bin = process.env.PDFTOCAIRO || 'pdftocairo';

mkdirSync(outDir, { recursive: true });

// 整頁圖：約 1800px 寬、JPEG q85 → page-NN.jpg
execFileSync(bin, [
  '-jpeg', '-scale-to-x', '1800', '-scale-to-y', '-1',
  '-jpegopt', 'quality=85', pdf, join(outDir, 'page'),
], { stdio: 'inherit' });

// 縮圖：約 320px 寬、JPEG q80 → thumb-NN.jpg
execFileSync(bin, [
  '-jpeg', '-scale-to-x', '320', '-scale-to-y', '-1',
  '-jpegopt', 'quality=80', pdf, join(outDir, 'thumb'),
], { stdio: 'inherit' });

const pageCount = readdirSync(outDir).filter((f) => /^page-\d+\.jpg$/.test(f)).length;
const thumbCount = readdirSync(outDir).filter((f) => /^thumb-\d+\.jpg$/.test(f)).length;
console.log(`Generated ${pageCount} pages + ${thumbCount} thumbs in public/intro/`);
```

- [ ] **Step 2: 加 npm script**

Modify `package.json` 的 `"scripts"`，新增一行（放在 `"astro"` 之後即可）：

```json
    "build:intro": "node scripts/build-intro-images.mjs",
```

- [ ] **Step 3: 執行轉檔**

Run: `npm run build:intro`
（若報 `pdftocairo` 找不到：本機已知路徑為 `/c/poppler/poppler-24.08.0/Library/bin`，可 `PDFTOCAIRO=/c/poppler/poppler-24.08.0/Library/bin/pdftocairo.exe npm run build:intro`。）
Expected: 印出 `Generated 25 pages + 25 thumbs in public/intro/`。

- [ ] **Step 4: 驗證產出**

Run: `ls public/intro/ | head` 並確認：
- 檔名為 `page-01.jpg … page-25.jpg`、`thumb-01.jpg … thumb-25.jpg`（**2 位補零**；若不是 2 位，回頭調整 `flipbook.js` 的 `pad` 寬度）。
- 隨手開 `page-05.jpg`（師資文字頁）確認文字夠銳利、`page-01.jpg`（封面）正常。
- 整頁圖總量落在約 5–8MB（過大則把 `-scale-to-x` 降到 1600 重跑）。

- [ ] **Step 5: Commit**

Stage：`scripts/build-intro-images.mjs`、`package.json`、`public/intro/`（全部圖片）
英文標題：`Add PDF-to-image conversion script and intro brochure assets.`（如 `K260628D`）。用 `/commit`，經使用者確認後 commit。

---

### Task 3: 翻頁頁面 `intro.astro`（基礎層＋StPageFlip＋全部控制）

**Files:**
- Create: `src/pages/intro.astro`
- Modify: `package.json`（新增相依 `page-flip`）

**Interfaces:**
- Consumes: `src/lib/flipbook.js` 的 `buildPages` / `formatPageLabel`（Task 1）；`public/intro/*.jpg`（Task 2）；`page-flip` 的 `PageFlip`。
- Produces: 路由 `/intro`（供 Task 4 連結）。

- [ ] **Step 1: 安裝 StPageFlip**

Run: `npm install page-flip`
Expected: `package.json` 的 `dependencies` 出現 `page-flip`，`npm test` 仍綠。

- [ ] **Step 2: 建立 `intro.astro`（markup＋樣式）**

Create `src/pages/intro.astro`（先放結構與樣式，下一步再加 script）：

```astro
---
import Layout from '../layouts/Layout.astro';
import { buildPages } from '../lib/flipbook.js';

const TOTAL = 25;
const pages = buildPages(TOTAL);
---
<Layout title="社團介紹">
  <h1>社團介紹</h1>
  <p class="muted">翻閱集美國小國樂團介紹（共 {TOTAL} 頁）。手機可左右滑動翻頁。</p>

  <div class="flip-frame" id="flip-frame">
    <div class="intro-controls" id="intro-controls" hidden>
      <button class="btn ghost" id="btn-prev" type="button">◀ 上一頁</button>
      <span class="page-label" id="page-label">1 / {TOTAL}</span>
      <button class="btn ghost" id="btn-next" type="button">下一頁 ▶</button>
      <span class="spacer"></span>
      <button class="btn ghost" id="btn-thumbs" type="button">縮圖</button>
      <button class="btn ghost" id="btn-zoom" type="button">放大</button>
      <button class="btn ghost" id="btn-fs" type="button">全螢幕</button>
    </div>
    <div class="flip-stage" id="flip-stage"></div>
  </div>

  <div class="thumbs" id="thumbs" hidden>
    {pages.map((p) => (
      <button class="thumb" type="button" data-index={p.index - 1} aria-label={p.alt}>
        <img src={p.thumb} alt={p.alt} loading="lazy" />
      </button>
    ))}
  </div>

  <div class="intro-fallback" id="intro-fallback">
    {pages.map((p) => <img src={p.src} alt={p.alt} loading="lazy" />)}
  </div>

  <div class="zoom-overlay" id="zoom-overlay" hidden>
    <button class="zoom-close" id="zoom-close" type="button" aria-label="關閉放大">✕</button>
    <div class="zoom-scroll"><img id="zoom-img" alt="" /></div>
  </div>
</Layout>

<style>
  .flip-frame{margin:1rem auto 0;max-width:1040px}
  .intro-controls{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.7rem}
  .intro-controls .spacer{flex:1 1 auto}
  .intro-controls .btn.ghost{background:var(--paper-card);color:var(--brand);border:1px solid var(--line);padding:.35rem .8rem;font-size:.9rem;cursor:pointer}
  .intro-controls .btn.ghost:hover{background:var(--brand);color:#fff}
  .intro-controls .btn.ghost:disabled{opacity:.4;cursor:default;background:var(--paper-card);color:var(--muted)}
  .page-label{font-weight:700;color:var(--ink);min-width:4.5rem;text-align:center}
  .flip-stage{width:100%;max-width:1400px;margin:0 auto}

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

  /* 全螢幕（原生 API）＋無 API 時的填滿視窗退路 */
  #flip-frame:fullscreen{background:var(--paper);display:flex;flex-direction:column;justify-content:center;padding:1rem;max-width:none}
  #flip-frame:fullscreen .flip-stage{max-width:min(95vw,1400px)}
  .flip-frame.fill-viewport{position:fixed;inset:0;z-index:1500;background:var(--paper);max-width:none;display:flex;flex-direction:column;justify-content:center;padding:1rem;overflow:auto}
  .flip-frame.fill-viewport .flip-stage{max-width:min(95vw,1400px)}
</style>
```

- [ ] **Step 3: 加 client script（StPageFlip 初始化＋控制）**

在 `intro.astro` 的 `</style>` 之後（檔案結尾）加上：

```astro
<script>
  import { PageFlip } from 'page-flip';
  import { buildPages, formatPageLabel } from '../lib/flipbook.js';

  const TOTAL = 25;
  const pages = buildPages(TOTAL);

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
  const thumbs = $('thumbs');
  const zoomOverlay = $('zoom-overlay');
  const zoomImg = $('zoom-img');
  const zoomClose = $('zoom-close');

  const flip = new PageFlip(stage, {
    width: 1000,
    height: 563,
    size: 'stretch',
    minWidth: 320,
    maxWidth: 1400,
    minHeight: 180,
    maxHeight: 788,
    maxShadowOpacity: 0.5,
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: true,
  });

  flip.loadFromImages(pages.map((p) => p.src));

  const current = () => flip.getCurrentPageIndex();

  function syncUI() {
    const idx = current();
    label.textContent = formatPageLabel(idx + 1, TOTAL);
    btnPrev.disabled = idx <= 0;
    btnNext.disabled = idx >= TOTAL - 1;
    thumbs.querySelectorAll('.thumb').forEach((t, i) => {
      t.classList.toggle('is-current', i === idx);
    });
  }

  // 只有 StPageFlip 成功 init 後才隱藏基礎層（init 不觸發＝退路續顯）
  flip.on('init', () => {
    controls.hidden = false;
    fallback.hidden = true;
    syncUI();
  });
  flip.on('flip', syncUI);

  btnPrev.addEventListener('click', () => flip.flipPrev());
  btnNext.addEventListener('click', () => flip.flipNext());

  btnThumbs.addEventListener('click', () => { thumbs.hidden = !thumbs.hidden; });
  thumbs.querySelectorAll('.thumb').forEach((t) => {
    t.addEventListener('click', () => {
      flip.flip(Number(t.dataset.index));
      thumbs.hidden = true;
    });
  });

  // 放大檢視
  function openZoom() {
    const p = pages[current()];
    zoomImg.src = p.src;
    zoomImg.alt = p.alt;
    zoomImg.classList.remove('is-2x');
    zoomOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeZoom() {
    zoomOverlay.hidden = true;
    document.body.style.overflow = '';
  }
  btnZoom.addEventListener('click', openZoom);
  zoomClose.addEventListener('click', closeZoom);
  zoomOverlay.addEventListener('click', (e) => { if (e.target === zoomOverlay) closeZoom(); });
  zoomImg.addEventListener('click', () => zoomImg.classList.toggle('is-2x'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !zoomOverlay.hidden) closeZoom(); });

  // 全螢幕（原生 API；不支援則退化為填滿視窗 class）
  const canFs = !!(frame.requestFullscreen && document.exitFullscreen);
  btnFs.addEventListener('click', () => {
    if (canFs) {
      if (!document.fullscreenElement) frame.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    } else {
      frame.classList.toggle('fill-viewport');
      setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
  });
</script>
```

- [ ] **Step 4: build 驗證**

Run: `npm run build`
Expected: 建置成功、無錯（`page-flip` 正確打包、`/intro` 產出）。

- [ ] **Step 5: dev server 實測**

Run: `npm run dev`（http://localhost:4321/intro）。逐項確認：
- 桌機：呈現**單頁**（非兩頁並排）；點「下一頁／上一頁」有翻頁動畫；頁碼隨翻頁更新（`3 / 25`）；第一頁時「上一頁」反灰、最後一頁時「下一頁」反灰。
- 「縮圖」可開關格狀總覽；點任一縮圖跳到該頁並關閉總覽；當前頁縮圖有綠框。
- 「放大」開啟疊層、顯示當前頁；桌機點圖在 1×/放大間切換；Esc／✕／點背景可關閉。
- 「全螢幕」進入後仍為單頁、置中、可翻頁；再按或 Esc 退出。
- 手機尺寸（preview_resize 或瀏覽器 devtools）：可左右滑動翻頁、版面不破。
- DevTools console 無錯誤。

- [ ] **Step 6: no-JS 退路驗證**

在瀏覽器 DevTools 停用 JavaScript 重新整理 `/intro`：應看到 `intro-fallback` 的 25 張整頁圖直向排列、可完整捲動瀏覽（控制列與翻頁台不出現、不破版）。

- [ ] **Step 7: Commit**

Stage：`src/pages/intro.astro`、`package.json`、`package-lock.json`
英文標題：`Add club intro flipbook page with StPageFlip viewer.`（如 `K260628E`）。用 `/commit`，經使用者確認後 commit。

---

### Task 4: 「關於我們」頁加入口卡

**Files:**
- Modify: `src/pages/about.astro:15`（在「社團簡介」`</section>` 之後插入入口卡）＋ `<style>` 區塊（第 64–69 行）加樣式

**Interfaces:**
- Consumes: 路由 `/intro`（Task 3）、封面縮圖 `/intro/thumb-01.jpg`（Task 2）。
- Produces: 無（純連結）。

- [ ] **Step 1: 插入入口卡**

在 `src/pages/about.astro`，於「社團簡介」`</section>`（第 15 行）之後、`<h2 style="margin-top:2rem">核心團隊</h2>`（第 17 行）之前插入：

```astro
  <a class="card intro-entry" href="/intro">
    <img src="/intro/thumb-01.jpg" alt="集美國小國樂團介紹電子書封面" loading="lazy" />
    <div class="intro-entry-text">
      <strong>翻閱社團介紹 →</strong>
      <p class="muted">25 頁的國樂團介紹電子書，可翻頁、放大、全螢幕閱讀。</p>
    </div>
  </a>
```

- [ ] **Step 2: 加入口卡樣式**

在 `src/pages/about.astro` 的 `<style>` 區塊內新增：

```css
  .intro-entry{display:flex;gap:1rem;align-items:center;text-decoration:none;color:inherit;margin:1rem 0}
  .intro-entry:hover{border-color:var(--gold)}
  .intro-entry img{width:160px;height:auto;border-radius:8px;border:1px solid var(--line);flex-shrink:0}
  .intro-entry-text strong{color:var(--brand);font-size:1.1rem}
  .intro-entry-text p{margin:.3rem 0 0}
  @media (max-width:480px){.intro-entry{flex-direction:column;align-items:flex-start}.intro-entry img{width:100%}}
```

- [ ] **Step 3: build 驗證**

Run: `npm run build`
Expected: 成功、無錯。

- [ ] **Step 4: dev server 實測**

`npm run dev` → 開 `/about`：在「社團簡介」下方看到入口卡（封面縮圖＋「翻閱社團介紹 →」）；點擊導到 `/intro` 翻頁書；手機寬度下卡片改直向、圖滿版。

- [ ] **Step 5: Commit**

Stage：`src/pages/about.astro`
英文標題：`Link club intro flipbook from the About page.`（如 `K260628F`）。用 `/commit`，經使用者確認後 commit。

---

## 驗收（全部完成後）

- `npm test` 綠（`flipbook.test.js`）。
- `npm run build` 無誤。
- `/intro`：桌機單頁翻頁、頁碼、縮圖跳頁、放大、全螢幕、手機滑動皆正常；停用 JS 仍可看完整 25 頁。
- `/about`：入口卡顯示封面、連到 `/intro`。
- `public/intro/` 圖片總量合理（約 5–8MB），初次載入只抓前一兩頁（其餘 lazy）。

## 後續部署提醒（非本計畫程式碼工作）

- 在 GitHub Desktop 按 **Push** → Cloudflare 自動 `npm run build` 重新部署（從 `main`）。
- 連結預覽（LINE）快取：若要立即看到，網址後加新參數（如 `/intro?v=1`）。

## 不做（YAGNI，沿用 spec §10）

PDF 下載、翻頁音效、雙頁跨頁、單頁深連結（`#p=5`）、頁內文字搜尋、後台上傳介面。
