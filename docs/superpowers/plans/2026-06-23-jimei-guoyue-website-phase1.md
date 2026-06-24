# 集美國小國樂社網站 Phase 1 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Astro 建出集美國小國樂社資訊網站的 Phase 1（可上線版本）：首頁、行事曆、最新公告、認識我們、文件下載、頁尾聯絡。

**Architecture:** 靜態網站（Astro，build 成純 HTML/CSS），共用版型（Layout/Header/Footer）。會頻繁變動的資料外接 Google：行事曆用 Google 日曆 `iframe` 即時嵌入；最新公告由前端在瀏覽器即時讀取「Google 試算表發布的 CSV」並渲染（太太改試算表→重整即生效，免重新部署）。半靜態內容（簡介、老師、幹部、文件清單）放在 `src/data/*.js`，方便日後修改。

**Tech Stack:** Astro · 原生 HTML/CSS/JS · vitest（僅測公告解析邏輯）· Google 日曆／試算表／雲端硬碟 · Cloudflare Pages 或 Netlify（免費託管）

---

## 驗證策略（請先讀）

- **內容／版型 task**：以 `npm run dev` 在瀏覽器目視確認，並以 `npm run build` 確認無錯。
- **公告解析邏輯 task**：用 vitest 寫單元測試（TDD）。這是唯一有「純邏輯」的部分。
- **理由**：本站主體是內容呈現與第三方嵌入，沒有複雜後端；對這類網站，「build 成功＋目視」是合適且誠實的驗證，硬寫 UI 單元測試價值低。

## commit 慣例

每個 task 結尾 commit。訊息沿用專案慣例：`KyymmddX [JimeiGuoyue] <英文標題>.`（執行當日依序編號，例 `K260705A`、`K260705B`…）。**依專案規則，每次 `git commit` 前先讓使用者確認再執行。** 下方各步驟只寫英文標題，執行時補上日期編號。

---

## 開工前準備（Prep）

部分 task 需要真實素材才能「最終完成」，但**都能先用範例資料開發**，素材到位再替換。建議先請社團準備：

- [ ] **申請一個社團專用 Gmail 帳號**（所有 Google 工具掛這個帳號，方便幹部交接）。
- [ ] **建立社團 Google 日曆**，於「設定 → 整合日曆」取得**嵌入網址**（給 Task 7）。
- [ ] **建立公告 Google 試算表**：四欄 `日期 / 標題 / 內容 / 置頂`（置頂欄打記號如 `V`／`是` 即固定該則於最前，留空＝一般公告）；「檔案 → 共用 → 發布到網路 → CSV」取得**發布後的 CSV 連結**（給 Task 6）。
- [ ] **建立 Google 雲端硬碟資料夾**放文件，取得各檔案的**共用連結**（給 Task 9）。
- [ ] 蒐集**社團簡介文字、指導老師名單與照片、幹部名單**（給 Task 8）。
- [ ] 確認**學校全名與聯絡窗口**（給 Task 3 頁尾）。

> 素材未齊不影響先開工：範例資料已內建在計畫中。

---

## File Structure

```
集美國樂網頁設計/
├─ package.json                 # 專案與 scripts（dev/build/test）
├─ astro.config.mjs             # Astro 設定
├─ .env                         # PUBLIC_ANNOUNCEMENTS_CSV（公告 CSV 連結）
├─ public/
│  ├─ sample-announcements.csv  # 開發用範例公告
│  └─ images/                   # 老師/幹部照片（之後放）
├─ src/
│  ├─ styles/global.css         # 全站配色（傳統雅致）與基礎樣式
│  ├─ layouts/Layout.astro      # HTML 骨架＋字體＋Header/Footer
│  ├─ components/
│  │  ├─ Header.astro           # 導覽列
│  │  └─ Footer.astro           # 頁尾聯絡
│  ├─ lib/
│  │  ├─ announcements.js       # 公告 CSV 解析與抓取（純函式）
│  │  └─ announcements.test.js  # vitest 單元測試
│  ├─ data/
│  │  ├─ club.js                # 社團簡介
│  │  ├─ teachers.js            # 指導老師
│  │  ├─ officers.js            # 幹部
│  │  └─ documents.js           # 文件下載清單
│  └─ pages/
│     ├─ index.astro            # 首頁
│     ├─ calendar.astro         # 行事曆（Google 日曆嵌入）
│     ├─ announcements.astro    # 最新公告（前端讀 CSV）
│     ├─ about.astro            # 認識我們（簡介＋老師＋幹部）
│     └─ documents.astro        # 文件下載
```

---

## Task 1：初始化 Astro 專案

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`（由 Astro 產生）

- [ ] **Step 1：在專案資料夾建立 Astro（空白範本）**

在專案根目錄執行（Windows PowerShell 或終端機）：
```bash
npm create astro@latest -- --template minimal --no-install --no-git --yes .
```
> 已在現有資料夾、且已是 git repo，故用 `--no-git`、目標為 `.`。

- [ ] **Step 2：安裝相依套件**

```bash
npm install
```

- [ ] **Step 3：啟動開發伺服器確認可跑**

Run: `npm run dev`
Expected: 終端機顯示 `astro` 啟動、`http://localhost:4321`；瀏覽器開該網址看到 Astro 預設頁。確認後 `Ctrl+C` 停止。

- [ ] **Step 4：確認 build 成功**

Run: `npm run build`
Expected: 產生 `dist/`，無錯誤。

- [ ] **Step 5：Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src public .gitignore
git commit   # [JimeiGuoyue] Scaffold Astro project.
```
> Astro 的 `.gitignore` 會新增 `dist/`、`node_modules/` 等；與既有 `.gitignore` 合併即可。

---

## Task 2：全站配色與基礎樣式

**Files:**
- Create: `src/styles/global.css`

- [ ] **Step 1：建立全站樣式（傳統雅致配色）**

`src/styles/global.css`：
```css
:root{
  --vermilion:#9E2B25;     /* 朱紅：主色 */
  --vermilion-dark:#7d211c;
  --ink:#1C1C1C;           /* 墨：標題/內文 */
  --gold:#C8A45C;          /* 金：點綴 */
  --paper:#F5EFE1;         /* 宣紙底 */
  --paper-card:#FFFDF7;
  --text:#2B2B2B;
  --muted:#6B6258;
  --line:#E7DDC7;
  --maxw:1000px;
}
*{box-sizing:border-box}
html{font-family:"Noto Sans TC",system-ui,sans-serif;color:var(--text);background:var(--paper);line-height:1.7}
body{margin:0;min-height:100vh;display:flex;flex-direction:column}
main{flex:1 0 auto}
h1,h2,h3{font-family:"Noto Serif TC","Noto Sans TC",serif;color:var(--ink);line-height:1.35}
h1{font-size:1.8rem;margin:.2rem 0 1rem}
a{color:var(--vermilion)}
.container{width:100%;max-width:var(--maxw);margin:0 auto;padding:1.5rem 1.25rem}
.card{background:var(--paper-card);border:1px solid var(--line);border-radius:12px;padding:1rem 1.25rem;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.grid{display:grid;gap:1rem}
.grid.cols-2{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.grid.cols-3{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.btn{display:inline-block;background:var(--vermilion);color:#fff;padding:.5rem 1.1rem;border-radius:999px;text-decoration:none;font-weight:500}
.btn:hover{background:var(--vermilion-dark)}
.muted{color:var(--muted)}
.label{font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
time{color:var(--vermilion);font-weight:500}
```

- [ ] **Step 2：先擱置，於 Task 3 由 Layout 載入後一起驗證。**（此步無需指令）

- [ ] **Step 3：Commit**

```bash
git add src/styles/global.css
git commit   # [JimeiGuoyue] Add site-wide palette and base styles.
```

---

## Task 3：共用版型、導覽列、頁尾

**Files:**
- Create: `src/layouts/Layout.astro`, `src/components/Header.astro`, `src/components/Footer.astro`

- [ ] **Step 1：建立 Layout**

`src/layouts/Layout.astro`：
```astro
---
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import '../styles/global.css';
const { title = '', description = '集美國小國樂社社團資訊' } = Astro.props;
---
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title ? `${title}｜集美國小國樂社` : '集美國小國樂社'}</title>
    <meta name="description" content={description} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <Header />
    <main><div class="container"><slot /></div></main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2：建立 Header（導覽）**

`src/components/Header.astro`：
```astro
---
const nav = [
  { href: '/', label: '首頁' },
  { href: '/calendar', label: '行事曆' },
  { href: '/announcements', label: '最新公告' },
  { href: '/about', label: '認識我們' },
  { href: '/documents', label: '文件下載' },
];
const path = Astro.url.pathname;
---
<header class="site-header">
  <div class="container header-inner">
    <a href="/" class="brand">🎵 集美國小國樂社</a>
    <nav>
      {nav.map((n) => (
        <a href={n.href} class={path === n.href ? 'active' : ''}>{n.label}</a>
      ))}
    </nav>
  </div>
</header>
<style>
  .site-header{background:var(--vermilion)}
  .header-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding-top:.7rem;padding-bottom:.7rem}
  .brand{color:#fff;text-decoration:none;font-weight:700;font-size:1.15rem}
  nav{display:flex;gap:1.1rem;flex-wrap:wrap}
  nav a{color:#fff;text-decoration:none;opacity:.9;padding:.15rem 0;border-bottom:2px solid transparent}
  nav a:hover,nav a.active{opacity:1;border-bottom-color:var(--gold)}
</style>
```

- [ ] **Step 3：建立 Footer（頁尾聯絡）**

`src/components/Footer.astro`（**括號內請於 Prep 後替換成真實資訊**）：
```astro
---
const club = {
  name: '集美國小國樂社',
  school: '（學校全名，例：○○市○○國民小學）',
  contact: '（社團聯絡窗口姓名 / 電話）',
  email: '（社團 Gmail）@gmail.com',
};
---
<footer class="site-footer">
  <div class="container">
    <strong>{club.name}</strong>
    <p class="muted">{club.school}</p>
    <p>聯絡：{club.contact}</p>
    <p>Email：<a href={`mailto:${club.email}`}>{club.email}</a></p>
  </div>
</footer>
<style>
  .site-footer{background:var(--ink);color:#d8d2c4;font-size:.9rem;padding:1.4rem 0;margin-top:1.5rem}
  .site-footer a{color:var(--gold)}
  .site-footer p{margin:.15rem 0}
</style>
```

- [ ] **Step 4：放一個臨時首頁以便驗證版型**

`src/pages/index.astro`（暫定，Task 4 會改寫）：
```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="首頁">
  <h1>版型測試</h1>
  <p>確認導覽列、配色、頁尾正常。</p>
</Layout>
```

- [ ] **Step 5：目視驗證**

Run: `npm run dev` → 開 `http://localhost:4321`
Expected: 朱紅導覽列＋宣紙底背景＋墨色標題＋深色頁尾；點導覽各連結（除首頁外會 404，正常，後續 task 補頁）。

- [ ] **Step 6：Commit**

```bash
git add src/layouts/Layout.astro src/components/Header.astro src/components/Footer.astro src/pages/index.astro
git commit   # [JimeiGuoyue] Add shared layout, header nav, and footer.
```

---

## Task 4：首頁骨架

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1：改寫首頁（hero ＋ 各區入口 ＋ 公告/行程佔位）**

`src/pages/index.astro`：
```astro
---
import Layout from '../layouts/Layout.astro';
const sections = [
  { href: '/calendar', icon: '📅', title: '行事曆', desc: '練習、活動、比賽、演出時間' },
  { href: '/announcements', icon: '📢', title: '最新公告', desc: '通知、提醒、臨時異動' },
  { href: '/about', icon: 'ℹ️', title: '認識我們', desc: '社團簡介、指導老師、幹部' },
  { href: '/documents', icon: '📄', title: '文件下載', desc: '通知單、樂譜、報名表' },
];
---
<Layout title="首頁">
  <section class="hero card">
    <p class="label">集美國小・學生家長社團</p>
    <h1>集美國小國樂社</h1>
    <p class="muted">這裡是社團的資訊家：行事曆、公告、文件都在這，隨時可查、長期留存。</p>
    <a class="btn" href="/calendar">看近期行事曆</a>
  </section>

  <h2 style="margin-top:2rem">最新公告</h2>
  <div id="home-announcements" class="grid cols-2"><p class="muted">載入中…</p></div>

  <h2 style="margin-top:2rem">快速前往</h2>
  <div class="grid cols-2">
    {sections.map((s) => (
      <a class="card section-link" href={s.href}>
        <div class="section-icon">{s.icon}</div>
        <div><strong>{s.title}</strong><p class="muted">{s.desc}</p></div>
      </a>
    ))}
  </div>
</Layout>
<style>
  .hero h1{margin:.3rem 0 .5rem}
  .section-link{display:flex;gap:.8rem;align-items:flex-start;text-decoration:none;color:inherit}
  .section-link:hover{border-color:var(--gold)}
  .section-icon{font-size:1.6rem;line-height:1}
  .section-link p{margin:.2rem 0 0}
</style>
```

> `#home-announcements` 的內容會在 Task 6 由公告腳本填入近期幾則。

- [ ] **Step 2：目視驗證**

Run: `npm run dev`
Expected: 首頁顯示 hero、「最新公告（載入中…）」、四個快速前往卡片。

- [ ] **Step 3：Commit**

```bash
git add src/pages/index.astro
git commit   # [JimeiGuoyue] Build home page shell with section links.
```

---

## Task 5：公告解析模組（vitest TDD）

**Files:**
- Create: `src/lib/announcements.js`, `src/lib/announcements.test.js`

- [ ] **Step 1：安裝 vitest 並加 test script**

```bash
npm install -D vitest
```
在 `package.json` 的 `"scripts"` 加入：
```json
"test": "vitest run"
```

- [ ] **Step 2：先寫失敗測試**

`src/lib/announcements.test.js`：
```js
import { describe, it, expect } from 'vitest';
import { parseAnnouncementsCsv, splitCsvLine } from './announcements.js';

describe('splitCsvLine', () => {
  it('splits plain comma fields', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('keeps commas inside quoted fields', () => {
    expect(splitCsvLine('2026-06-21,"演出","地點：禮堂，請準時"'))
      .toEqual(['2026-06-21', '演出', '地點：禮堂，請準時']);
  });
});

describe('parseAnnouncementsCsv', () => {
  it('parses rows and skips the header', () => {
    const csv = '日期,標題,內容\n2026-06-20,練習異動,本週六改上午九點\n';
    expect(parseAnnouncementsCsv(csv)).toEqual([
      { date: '2026-06-20', title: '練習異動', body: '本週六改上午九點' },
    ]);
  });
  it('ignores blank lines', () => {
    const csv = '日期,標題,內容\n\n2026-06-20,A,B\n\n';
    expect(parseAnnouncementsCsv(csv)).toHaveLength(1);
  });
});
```

- [ ] **Step 3：執行測試，確認失敗**

Run: `npm test`
Expected: FAIL（`announcements.js` 尚未匯出函式）。

- [ ] **Step 4：實作模組**

`src/lib/announcements.js`：
```js
// 解析「Google 試算表發布的 CSV」公告。欄位：日期, 標題, 內容
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function parseAnnouncementsCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  const items = [];
  for (let i = 1; i < lines.length; i++) { // 跳過標題列
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = splitCsvLine(line);
    const date = (cols[0] ?? '').trim();
    const title = (cols[1] ?? '').trim();
    const body = (cols[2] ?? '').trim();
    if (!date && !title && !body) continue;
    items.push({ date, title, body });
  }
  return items;
}

export async function fetchAnnouncements(csvUrl, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(csvUrl);
  if (!res.ok) throw new Error(`公告載入失敗：${res.status}`);
  const text = await res.text();
  return parseAnnouncementsCsv(text);
}
```

- [ ] **Step 5：執行測試，確認通過**

Run: `npm test`
Expected: PASS（全部測試綠燈）。

- [ ] **Step 6：Commit**

```bash
git add src/lib/announcements.js src/lib/announcements.test.js package.json package-lock.json
git commit   # [JimeiGuoyue] Add announcements CSV parser with vitest tests.
```

---

## Task 6：最新公告頁＋首頁公告摘要

**Files:**
- Create: `public/sample-announcements.csv`, `.env`, `src/pages/announcements.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1：建立開發用範例 CSV**

`public/sample-announcements.csv`：
```csv
日期,標題,內容
2026-06-22,本週六加強練習,六/27 上午 9:00–11:00 於音樂教室，請攜帶樂器與譜。
2026-06-18,暑期成果發表會時間確定,7/12（日）下午 2:00 學校禮堂，歡迎家長到場。
2026-06-10,新團員樂器調借,有需要調借樂器的家長請於文件下載填寫申請單。
```

- [ ] **Step 2：設定公告 CSV 來源環境變數**

`.env`（開發先用範例檔；上線改成「Google 試算表發布的 CSV 連結」）：
```
PUBLIC_ANNOUNCEMENTS_CSV=/sample-announcements.csv
```
> Astro 中以 `PUBLIC_` 開頭的變數可在瀏覽器端使用。確認 `.env` 已被 `.gitignore` 忽略；若否，於 `.gitignore` 補一行 `.env`。

- [ ] **Step 3：建立最新公告頁（前端即時讀取）**

`src/pages/announcements.astro`：
```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="最新公告">
  <h1>最新公告</h1>
  <p class="muted">資料即時同步自社團公告試算表；幹部更新後重整頁面即可看到。</p>
  <div id="announcements" class="grid cols-2"><p class="muted">載入中…</p></div>
</Layout>
<script>
  import { fetchAnnouncements } from '../lib/announcements.js';
  const url = import.meta.env.PUBLIC_ANNOUNCEMENTS_CSV;
  const el = document.getElementById('announcements');
  function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  try {
    const items = await fetchAnnouncements(url);
    el.innerHTML = items.length
      ? items.map((a) => `<article class="card"><time>${esc(a.date)}</time><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p></article>`).join('')
      : '<p class="muted">目前沒有公告。</p>';
  } catch (e) {
    el.innerHTML = '<p class="muted">公告載入失敗，請稍後再試。</p>';
  }
</script>
```

- [ ] **Step 4：首頁公告摘要接上（取最近 4 則）**

在 `src/pages/index.astro` 末端的 `<style>` 之前，加入腳本：
```astro
<script>
  import { fetchAnnouncements } from '../lib/announcements.js';
  const url = import.meta.env.PUBLIC_ANNOUNCEMENTS_CSV;
  const el = document.getElementById('home-announcements');
  function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  try {
    const items = (await fetchAnnouncements(url)).slice(0, 4);
    el.innerHTML = items.length
      ? items.map((a) => `<article class="card"><time>${esc(a.date)}</time><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p></article>`).join('')
      : '<p class="muted">目前沒有公告。</p>';
  } catch (e) {
    el.innerHTML = '<p class="muted">公告載入失敗。</p>';
  }
</script>
```

- [ ] **Step 5：目視驗證**

Run: `npm run dev`
Expected: `/announcements` 顯示三則範例公告卡片；首頁「最新公告」區顯示最近數則。

- [ ] **Step 6：Commit**

```bash
git add public/sample-announcements.csv src/pages/announcements.astro src/pages/index.astro .gitignore
git commit   # [JimeiGuoyue] Add announcements page and home summary via live CSV.
```

---

## Task 7：行事曆頁（Google 日曆嵌入）

**Files:**
- Create: `src/pages/calendar.astro`

- [ ] **Step 1：建立行事曆頁**

`src/pages/calendar.astro`（`CALENDAR_EMBED_SRC` 於 Prep 後替換成社團日曆的嵌入網址）：
```astro
---
import Layout from '../layouts/Layout.astro';
// 取得方式：Google 日曆 → 設定 → 該日曆「整合日曆」→ 複製「嵌入程式碼」中的 src。
const CALENDAR_EMBED_SRC =
  'https://calendar.google.com/calendar/embed?src=REPLACE_WITH_CALENDAR_ID&ctz=Asia%2FTaipei';
const configured = !CALENDAR_EMBED_SRC.includes('REPLACE_WITH_CALENDAR_ID');
---
<Layout title="行事曆">
  <h1>行事曆</h1>
  <p class="muted">練習、活動、比賽、演出時間，即時同步自社團 Google 日曆。</p>
  {configured ? (
    <div class="cal-wrap card">
      <iframe src={CALENDAR_EMBED_SRC} width="100%" height="600" style="border:0" frameborder="0" scrolling="no" title="社團行事曆"></iframe>
    </div>
  ) : (
    <div class="card"><p>⚠️ 行事曆尚未設定。請將 <code>calendar.astro</code> 中的 <code>CALENDAR_EMBED_SRC</code> 換成社團 Google 日曆的嵌入網址。</p></div>
  )}
</Layout>
<style>
  .cal-wrap{padding:.5rem}
  .cal-wrap iframe{display:block;border-radius:8px}
</style>
```

- [ ] **Step 2：目視驗證**

Run: `npm run dev` → `/calendar`
Expected: 未設定前顯示提醒卡片；填入真實 `src` 後顯示日曆。兩種狀態皆不報錯。

- [ ] **Step 3：Commit**

```bash
git add src/pages/calendar.astro
git commit   # [JimeiGuoyue] Add calendar page embedding Google Calendar.
```

---

## Task 8：認識我們（簡介＋指導老師＋幹部）

**Files:**
- Create: `src/data/club.js`, `src/data/teachers.js`, `src/data/officers.js`, `src/pages/about.astro`

- [ ] **Step 1：建立資料檔（範例內容，Prep 後替換）**

`src/data/club.js`：
```js
export const club = {
  intro: '集美國小國樂社由學生家長共同組成，以推廣傳統國樂、培養孩子的音樂興趣與團隊精神為宗旨。社團定期練習，並參與校內外演出與比賽。',
  features: ['每週固定練習', '校內外演出與比賽', '家長共同參與經營'],
  ensemble: '樂團編制：彈撥（琵琶、柳琴、阮）、拉弦（二胡、中胡）、吹管（笛、笙）、打擊。',
};
```

`src/data/teachers.js`：
```js
export const teachers = [
  { name: '（指導老師姓名）', subject: '指揮 / 二胡', bio: '（簡短介紹：經歷、專長）', photo: '' },
  { name: '（指導老師姓名）', subject: '彈撥', bio: '（簡短介紹）', photo: '' },
];
```

`src/data/officers.js`：
```js
export const officers = [
  { role: '會長', name: '（姓名）', note: '' },
  { role: '副會長', name: '（姓名）', note: '' },
  { role: '總務', name: '（姓名）', note: '' },
  { role: '文書', name: '（姓名）', note: '' },
];
```

- [ ] **Step 2：建立認識我們頁**

`src/pages/about.astro`：
```astro
---
import Layout from '../layouts/Layout.astro';
import { club } from '../data/club.js';
import { teachers } from '../data/teachers.js';
import { officers } from '../data/officers.js';
---
<Layout title="認識我們">
  <h1>認識我們</h1>

  <section class="card">
    <h2>社團簡介</h2>
    <p>{club.intro}</p>
    <ul>{club.features.map((f) => <li>{f}</li>)}</ul>
    <p class="muted">{club.ensemble}</p>
  </section>

  <h2 style="margin-top:2rem">指導老師</h2>
  <div class="grid cols-2">
    {teachers.map((t) => (
      <article class="card person">
        <div class="avatar">{t.photo ? <img src={t.photo} alt={t.name} /> : '🎵'}</div>
        <div>
          <strong>{t.name}</strong>
          <p class="label">{t.subject}</p>
          <p>{t.bio}</p>
        </div>
      </article>
    ))}
  </div>

  <h2 style="margin-top:2rem">幹部介紹</h2>
  <div class="grid cols-3">
    {officers.map((o) => (
      <article class="card">
        <p class="label">{o.role}</p>
        <strong>{o.name}</strong>
        {o.note && <p class="muted">{o.note}</p>}
      </article>
    ))}
  </div>
</Layout>
<style>
  .person{display:flex;gap:.9rem;align-items:flex-start}
  .avatar{width:64px;height:64px;border-radius:50%;background:var(--paper);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:1.5rem;overflow:hidden;flex-shrink:0}
  .avatar img{width:100%;height:100%;object-fit:cover}
  .person ul{margin:.3rem 0}
</style>
```

- [ ] **Step 3：目視驗證**

Run: `npm run dev` → `/about`
Expected: 顯示簡介、老師卡片（無照片時顯示 🎵）、幹部卡片。

- [ ] **Step 4：Commit**

```bash
git add src/data/club.js src/data/teachers.js src/data/officers.js src/pages/about.astro
git commit   # [JimeiGuoyue] Add about page with club intro, teachers, officers.
```

---

## Task 9：文件下載

**Files:**
- Create: `src/data/documents.js`, `src/pages/documents.astro`

- [ ] **Step 1：建立文件資料檔（範例，Prep 後換成真實 Drive 連結）**

`src/data/documents.js`：
```js
export const documents = [
  { title: '（範例）社團報名表', url: 'https://drive.google.com/REPLACE', type: 'PDF', note: '新團員填寫' },
  { title: '（範例）樂器調借申請單', url: 'https://drive.google.com/REPLACE', type: 'PDF', note: '' },
  { title: '（範例）成果發表會通知單', url: 'https://drive.google.com/REPLACE', type: 'PDF', note: '' },
];
```

- [ ] **Step 2：建立文件下載頁**

`src/pages/documents.astro`：
```astro
---
import Layout from '../layouts/Layout.astro';
import { documents } from '../data/documents.js';
---
<Layout title="文件下載">
  <h1>文件下載</h1>
  <p class="muted">通知單、樂譜、報名與繳費表單。點擊在 Google 雲端硬碟開啟／下載。</p>
  <div class="grid cols-2">
    {documents.map((d) => (
      <a class="card doc" href={d.url} target="_blank" rel="noopener">
        <span class="doc-type">{d.type}</span>
        <span>
          <strong>{d.title}</strong>
          {d.note && <p class="muted">{d.note}</p>}
        </span>
      </a>
    ))}
  </div>
</Layout>
<style>
  .doc{display:flex;gap:.8rem;align-items:center;text-decoration:none;color:inherit}
  .doc:hover{border-color:var(--gold)}
  .doc-type{background:var(--vermilion);color:#fff;font-size:.7rem;padding:.2rem .5rem;border-radius:6px;flex-shrink:0}
  .doc p{margin:.15rem 0 0}
</style>
```

- [ ] **Step 3：目視驗證**

Run: `npm run dev` → `/documents`
Expected: 顯示文件卡片清單，連結可點（範例連結會導向佔位網址）。

- [ ] **Step 4：Commit**

```bash
git add src/data/documents.js src/pages/documents.astro
git commit   # [JimeiGuoyue] Add documents download page.
```

---

## Task 10：建置與部署

**Files:**
- Modify: `astro.config.mjs`（如需設定站台網址）

- [ ] **Step 1：最終 build 檢查**

Run: `npm run build`
Expected: 無錯誤，產出 `dist/`。可再執行 `npm run preview` 開預覽網址目視整站。

- [ ] **Step 2：推上 GitHub（供自動部署）**

在 GitHub 建一個 repo（如 `jimei-guoyue-web`），然後：
```bash
git remote add origin https://github.com/<你的帳號>/jimei-guoyue-web.git
git push -u origin main
```

- [ ] **Step 3：連接免費託管（擇一）**

- **Cloudflare Pages**：Dashboard → Pages → Connect to Git → 選 repo → Framework 選 Astro（build：`npm run build`，輸出：`dist`）。
- **Netlify**：Add new site → Import from Git → build：`npm run build`，publish：`dist`。

於託管平台的環境變數設定加入：
```
PUBLIC_ANNOUNCEMENTS_CSV = <Google 試算表發布的 CSV 連結>
```
> 之後每次 `git push`，網站自動重新部署。公告與行事曆因為是前端即時讀取，幹部更新後**不需重新部署**即生效。

- [ ] **Step 4：（選用）自訂網域**

於託管平台「Custom domain」綁定購買的 `.tw` 網域（約 NT$300–500/年），或先用平台提供的免費子網址。

- [ ] **Step 5：上線前替換真實素材檢查表**

- [ ] `.env` / 託管環境變數 `PUBLIC_ANNOUNCEMENTS_CSV` 指向真實公告試算表
- [ ] `calendar.astro` 的 `CALENDAR_EMBED_SRC` 換成真實日曆
- [ ] `Footer.astro` 學校全名、聯絡窗口、Email
- [ ] `src/data/*.js` 老師、幹部、文件換成真實內容與連結
- [ ] 老師／幹部照片放入 `public/images/` 並更新 `photo` 欄位

- [ ] **Step 6：Commit（如有設定調整）**

```bash
git add astro.config.mjs
git commit   # [JimeiGuoyue] Configure build/deploy settings.
git push
```

---

## 自我檢查（Self-Review 紀錄）

- **Spec 涵蓋**：Phase 1 範圍（首頁／行事曆／公告／認識我們〔簡介＋老師＋幹部〕／文件下載／頁尾聯絡）皆有對應 task；視覺風格＝spec 第 8 節色碼（Task 2）；低維護原則＝公告前端讀 CSV、行事曆 iframe（Task 6/7）。Phase 2–3（活動支援、相簿、成果、練習資源、FAQ）依約不在本計畫。
- **Placeholder**：素材類佔位皆以「（括號）」與 `REPLACE` 明確標示，並集中於 Task 10 Step 5 檢查表，非未定義的程式邏輯。
- **型別一致**：公告物件 `{date,title,body}` 於 `announcements.js`、測試、公告頁、首頁摘要四處一致；資料檔 `teachers/officers/documents` 欄位與 `about/documents` 頁面取用一致。

---

## 下一步（Phase 2 預告，不在本計畫）

活動支援報名（Google 表單＋公開看板）、活動相簿（Google 相簿）、成果與榮譽——待 Phase 1 上線後另開計畫。
