# 社團介紹電子書（翻頁書）— 設計文件（Design Spec）

- **日期**：2026-06-28
- **狀態**：設計定稿，待進入實作
- **關聯**：團員用外部網站 fliphtml5 做了一份社團介紹翻頁書（`https://online.fliphtml5.com/ZoweyHlkkk/pcht/`），但該站匯出 HTML／嵌入需付費解鎖。改為在本站自建同等功能，素材為 `Reference/集美國小國樂介紹.pdf`（25 頁、16:9 / 1440×810pt）。

---

## 1. 背景與目標

社團有一份設計精美的 25 頁介紹（封面、INTRODUCTION、師資介紹等），目前只能透過外部 fliphtml5 網站翻閱——要匯出或嵌入都得付費，且受制於外部網站存續與規則。

**目標**：在本站做一個**功能相同的翻頁電子書**，完全自己 host、零成本、不依賴外部網站。fliphtml5 背後原理就是「一疊頁面圖片 ＋ 一個 JS 翻頁引擎」，我們把這兩塊換成自己的即可。

**關鍵限制／原則**：
- 沿用本站**低維護原則**：這份介紹是設計好的成品、極少改；素材一次性轉檔、commit 進站，改版時重跑腳本即可。
- 沿用竹綠主題與既有版型（`Layout.astro` / `global.css`）。
- 對外招生用途、家長多用手機（LINE 導流），需**手機友善**。

---

## 2. 核心設計決策

| 項目 | 結論 | 說明 |
|---|---|---|
| 體驗 | **翻頁動畫為主、縮圖瀏覽為輔** | 真實翻頁＋滑動為主；縮圖總覽可快速跳頁，也是 no-JS／載入失敗的退路 |
| 翻頁引擎 | **StPageFlip（npm `page-flip`）** | MIT、零相依、支援觸控滑動、仍維護；用 Astro 打包進站，**不走 CDN**（避免外部 runtime 依賴） |
| 翻頁版式 | **單頁翻（不雙頁跨頁）** | 來源是 16:9 橫式整頁（像投影片）。兩張並排＝32:9 超寬難讀；單頁翻最貼近原版且桌機／手機一致 |
| 額外功能 | **全螢幕 ＋ 放大檢視** | 放大為文字較多的師資頁而設；手機單頁偏小時可看清 |
| 不做 | **PDF 下載、翻頁音效、雙頁跨頁** | 見 §10 |
| 位置 | **獨立頁 `/intro`** | 翻頁需整個版面空間；入口卡放「關於我們」頁，導覽列保持精簡（維持 8 項） |
| 素材 | **`pdftocairo` 轉 JPEG（自己 host）** | 25 頁逐頁轉圖＋縮圖，放 `public/intro/`；JPEG 相容廣、照片頁表現好（fliphtml5 亦用 JPEG） |

---

## 3. 架構與檔案

| 檔案 | 類型 | 職責 |
|---|---|---|
| `public/intro/page-01.jpg … page-25.jpg` | 新增（產出物） | 翻頁用整頁圖，約 1800px 寬 |
| `public/intro/thumb-01.jpg … thumb-25.jpg` | 新增（產出物） | 縮圖總覽用，約 320px 寬 |
| `scripts/build-intro-images.mjs` | 新增 | 轉檔腳本（Node ESM，跨平台）：呼叫 `pdftocairo` 產上述圖；可重跑（改版時用）。掛 npm script `build:intro` |
| `src/lib/flipbook.js` | 新增 | 純邏輯：頁碼補零、頁面清單、邊界夾擠、頁碼標籤 |
| `src/lib/flipbook.test.js` | 新增 | vitest 單元測試（對齊 `src/lib/` 慣例） |
| `src/pages/intro.astro` | 新增 | 翻頁頁面：基礎圖片清單（SSR）＋ client script 升級成翻頁書 ＋ 控制列 |
| `src/pages/about.astro` | 改 | 加一張「翻閱社團介紹」入口卡（用封面 `page-01.jpg` 當縮圖）連到 `/intro` |
| `package.json` | 改 | 新增相依 `page-flip`；新增 script `build:intro`（跑轉檔腳本） |

> **隔離原則**：`flipbook.js` 不碰 DOM、不呼叫網路——只做字串／陣列運算，純函式才能測。StPageFlip 初始化、全螢幕、放大、縮圖切換等 DOM 膠水碼留在 `intro.astro` 的 client script。

---

## 4. 頁面組成與資料流（漸進增強）

```
intro.astro（SSR 輸出）
  ├─ 基礎層：<div class="intro-fallback"> 依序列出 25 張 <img loading="lazy">（no-JS / 載入失敗也看得到整本）
  └─ client script（瀏覽器）：
       import { PageFlip } from 'page-flip'
       const pages = buildPages(25)              // 來自 flipbook.js
       1. 隱藏基礎層，建立翻頁容器
       2. new PageFlip(el, { 單頁/portrait、size:'stretch'、保持 16:9 })
          → loadFromImages(pages.map(p => p.src))
       3. 綁定控制列：上一頁/下一頁、頁碼 formatPageLabel(cur,total)
       4. 縮圖總覽：點 thumb → flip.flip(index)
       5. 全螢幕：Fullscreen API 套在翻頁容器（不支援時退化為填滿視窗的 CSS 類）
       6. 放大檢視：開 lightbox 疊層顯示當前 page 圖，手機 pinch、桌機滾輪/點擊縮放
```

- 圖片皆為站內**靜態本地資產**，無外部 fetch、無使用者輸入。
- 第一頁優先載入，其餘 `lazy`；StPageFlip 載入策略於實作時實測微調。

---

## 5. 純函式契約（給 TDD）

```js
// 頁碼補零（寬度依總頁數，25 頁 → 2 位）
pad(n, width = 2) -> "01" | "25"

// 頁面清單（dir 預設 '/intro'）
buildPages(count, { dir = '/intro' } = {}) ->
  [{ index: 1, src: '/intro/page-01.jpg', thumb: '/intro/thumb-01.jpg', alt: '社團介紹 第 1 頁' }, ...]

// 頁碼標籤
formatPageLabel(current, total) -> "3 / 25"
```

> 頁面邊界（翻到頭/尾）由 StPageFlip 內部處理（`flipPrev`/`flipNext` 到底自動 no-op），故不另寫 `clampPage`。

**測試重點**：補零（1→"01"、25→"25"、寬度）、`buildPages` 長度／路徑／alt 文案／count=0 回空陣列、`formatPageLabel`。

---

## 6. 轉檔規格（一次性，可重跑）

來源：`Reference/集美國小國樂介紹.pdf`（25 頁、1440×810pt、16:9）。

```sh
# 整頁圖（約 1800px 寬，品質 85）→ public/intro/page-01.jpg … page-25.jpg
pdftocairo -jpeg -scale-to-x 1800 -scale-to-y -1 -jpegopt quality=85 \
  "Reference/集美國小國樂介紹.pdf" public/intro/page

# 縮圖（約 320px 寬，品質 80）→ public/intro/thumb-01.jpg … thumb-25.jpg
pdftocairo -jpeg -scale-to-x 320 -scale-to-y -1 -jpegopt quality=80 \
  "Reference/集美國小國樂介紹.pdf" public/intro/thumb
```

- pdftocairo 依總頁數自動補零（25 頁 → `-01`…`-25`）；實作時確認實際檔名與補零寬度，`flipbook.js` 的 `pad()` 須一致。
- 解析度／品質為起點，依實測檔案大小與清晰度微調（目標：整本整頁圖約 5–8MB；文字頁要夠銳利）。
- **不**把原始 PDF 放進 `public/`（不提供下載；PDF 留在 `Reference/`）。

---

## 7. 顯示規格

- **版面**：頁面置中，翻頁容器維持 16:9（`aspect-ratio`），上下留白；竹綠主題。
- **控制列**：`◀ 上一頁`、`下一頁 ▶`、中間頁碼 `3 / 25`、`縮圖`（開/關總覽）、`全螢幕`、`放大`。
- **手機**：可左右**滑動**翻頁；控制列圖示精簡、可點範圍夠大。
- **縮圖總覽**：格狀 25 張縮圖，點擊跳該頁並關閉總覽；當前頁高亮。
- **放大**：疊層全幅顯示當前頁，可縮放、可關閉（Esc／點叉／點背景）。
- **全螢幕**：翻頁容器進入全螢幕；再點一次或 Esc 退出。

---

## 8. 降級與錯誤處理

| 情況 | 行為 |
|---|---|
| 無 JS | 顯示基礎層：25 張整頁圖直向排列，整本可讀（不開天窗） |
| 圖片載入失敗 | 該頁顯示替代文字（alt）；其餘頁不受影響 |
| Fullscreen API 不支援 | 退化為「填滿視窗」CSS 模式（非原生全螢幕但可用） |
| 視窗縮放／旋轉 | 翻頁容器依 `aspect-ratio` 自適應；StPageFlip `size:'stretch'` 重算 |

---

## 9. 安全與無障礙

- 全為站內**靜態圖片**、無外部 fetch、無使用者輸入、無 `innerHTML` 注入外部資料 → XSS 面幾近於零（與公告／看板那種讀外部 CSV 的頁面不同）。
- 每頁 `<img>` 給 `alt`（「社團介紹 第 N 頁」）。**已知限制**：內容是圖片不是可選取文字，翻頁書本身不利 SEO／螢幕報讀；社團的可讀文字介紹仍以「關於我們」頁為主（該頁有真實文字），翻頁書定位為視覺呈現。

---

## 10. 不做（YAGNI）

- 不做 **PDF 下載按鈕**、**翻頁音效**、**雙頁跨頁**（使用者已排除前二者；橫式版式不適合跨頁）。
- 不做 **分享連結／單頁深連結**（如 `#p=5`）、頁面內文字搜尋、SEO 文字化（未來可再評估）。
- 不做後台上傳介面：轉檔是開發者腳本（`pdftocairo`），改版時重跑即可。
- 不動導覽列項目、不動其他頁面（僅「關於我們」加一張入口卡）。

---

## 11. 驗收標準

- `npm test` 綠（`flipbook.test.js`）。
- `npm run build` 無誤。
- 預覽（preview）實測：
  - 桌機：翻頁動畫、上一頁/下一頁、頁碼、縮圖跳頁、全螢幕、放大皆正常。
  - 手機：可滑動翻頁、版面不破、文字頁放大後看得清。
  - 關閉 JS：基礎層 25 張圖可完整瀏覽。
  - 「關於我們」入口卡顯示封面縮圖、連到 `/intro`。
- 整本圖片總量在合理範圍（目標 5–8MB），初次載入只抓前一兩頁。

---

## 12. 待使用者完成

- 無外部服務設定（不需環境變數、不需 Google 工具）——完全自包。
- 知會：約 5–8MB 圖片會 commit 進 repo（靜態站經 Cloudflare 部署，可接受）。
- 未來介紹改版：替換 `Reference/` 的 PDF → 重跑 `npm run build:intro`（`scripts/build-intro-images.mjs`）→ push。
