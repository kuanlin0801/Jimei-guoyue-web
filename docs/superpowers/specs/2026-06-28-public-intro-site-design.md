# 對外公開版社團介紹（獨立站）— 設計文件（Design Spec）

- **日期**：2026-06-28
- **狀態**：設計定稿，待進入實作
- **關聯**：延伸 `2026-06-28-club-intro-flipbook-design.md`。站內 `/intro` 翻頁書要放到官方（公開）LINE，但本站是社團**內網**（靠網址不公開、無登入），直接把內網網址貼到公開 LINE 會讓整個內網（公告／文件／活動支援／關於我們含幹部聯絡）曝光。

---

## 1. 背景與目標

`/intro` 翻頁書是對外招生用的素材，本身適合公開；但它寄生在內網網域上。**洩漏點是「網域」不是「頁面」**——一旦內網網址出現在公開 LINE，任何人都能從網址列得知內網位址、點 header 導覽列或猜路徑逛遍內網。

**目標**：做一個**與內網不同網址、完全分離**的公開翻頁書頁面，放官方 LINE；內網維持「網址不公開」現狀、零改動。

**已排除的替代方案**：內網整站加登入（Cloudflare Access，家長要登入、摩擦大）；繼續用 fliphtml5（依賴想擺脫的外部工具、雙份維護）。決策見對話與本檔 §10。

---

## 2. 核心設計決策

| 項目 | 結論 | 說明 |
|---|---|---|
| 隔離方式 | **獨立網域（第二個部署）** | 唯一能擋「內網網域曝光」的做法；公開站與內網是不同 origin、互不相連 |
| 公開站形態 | **純靜態 `intro-public/` 資料夾** | 不經 Astro build（Astro 只處理 `src/`＋`public/`），內網永遠不會 serve 到它 |
| 部署 | **第二個 Cloudflare Pages 專案**（同 repo、輸出目錄 `intro-public`、無 build） | 沿用現有 GitHub→Cloudflare 流程；一次 push、兩站皆更新 |
| 內容 | **與 `/intro` 同翻頁體驗，但無導覽列／無連回內網** | 翻頁／縮圖跳頁／放大／全螢幕；自帶 page-flip 與圖片 |
| 素材同步 | **`build:intro` 擴充：產圖後同時放 `public/intro/` 與 `intro-public/`** | 一份來源、兩處輸出；換介紹只跑一次指令 |
| 連結預覽 | **加 Open Graph／Twitter meta** | 官方 LINE 貼出來的卡片含封面縮圖＋標題 |
| 內網 | **完全不動** | 站內 `/intro` 與「關於我們」入口卡照舊，給成員站內看 |

---

## 3. 架構與檔案

| 檔案 | 類型 | 職責 |
|---|---|---|
| `intro-public/index.html` | 新增（手寫，fallback 區由 build 注入） | 自包覆的公開翻頁書頁面：HTML 結構＋內嵌 CSS＋module script；無 header/footer/nav、無任何內網連結；含 OG meta。no-JS 退路區（整頁圖清單）由 `build:intro` 在 markers 間注入，前端 JS 直接讀這份清單推導頁數／縮圖 |
| `intro-public/page-flip.module.js` | 新增（由 build 複製） | 自 `node_modules/page-flip/dist/js/` 複製的 StPageFlip 函式庫（module build，自包覆 ESM、`export{… as PageFlip}`、無 bare import），自站 host、不走 CDN |
| `intro-public/page-01.jpg … page-23.jpg`、`thumb-01.jpg … thumb-23.jpg` | 新增（產出物） | 翻頁圖＋縮圖（與 `public/intro/` 同內容） |
| `scripts/build-intro-images.mjs` | 改 | 產圖後，額外把圖片＋`page-flip.module.js` 同步到 `intro-public/`（清除舊圖避免殘留），並把整頁圖 `<img>` 清單注入 `index.html` 的 fallback markers 之間 |
| `docs/superpowers/plans/2026-06-28-public-intro-go-live-checklist.md` | 新增（實作階段） | 第二個 Cloudflare Pages 專案的一次性設定步驟 |

> **隔離原則**：公開站是獨立 origin、只含翻頁書必需資產；無任何指向內網網域的字串。`intro-public/` 不被 Astro build 收錄，內網 `dist/` 不含它。

---

## 4. `intro-public/index.html` 規格

- **結構**：與 `src/pages/intro.astro` 相同的翻頁書 DOM（控制列：上一頁/下一頁、頁碼、縮圖、放大、全螢幕；翻頁台；縮圖面板；no-JS 整頁圖退路；放大疊層）。差別：**外層不套 Layout**，自己一份 `<!doctype html>`＋`<head>`，**無 Header／Footer／導覽列**。
- **載入**：`<script type="module">` 只 `import { PageFlip } from './page-flip.module.js'`。頁面清單**從注入在 `#intro-fallback` 的整頁圖 `<img>` 推導**（`srcs = [...fallback imgs].map(src)`；縮圖路徑 = `page-` 換 `thumb-`；頁碼標籤就地內嵌 `` `${c} / ${t}` ``，不需 `flipbook.js`）。其餘設定（單頁 portrait：`minWidth:1000`＋CSS 蓋 inline min-width、`[hidden]` 勝出、控制列／放大／全螢幕等）比照 `/intro`。縮圖面板由 JS 從 `srcs` 建立（純自家路徑、非外部輸入）。
- **`<head>` meta**（給 LINE／Messenger 預覽卡片）：
  - `<title>集美國小國樂團 介紹</title>`
  - `og:title`、`og:description`（招生導向一句）、`og:type=website`、`og:image`（指向同資料夾 `page-01.jpg` 封面，用**部署後的絕對網址**；設定時填）、`og:locale=zh_TW`，及對應 `twitter:card=summary_large_image`。
  - **無 `canonical` 指向內網**；不出現任何內網網址。
- **TOTAL**：23（與現況一致；換版時與 `build:intro` 的輸出頁數同步）。

> page-flip 的 module build 若含瀏覽器無法解析的 bare import，改用 `page-flip.browser.js`（全域 `St.PageFlip`）以一般 `<script>` 載入；實作時實測擇一。

---

## 5. `build:intro` 擴充（素材同步）

現行 `scripts/build-intro-images.mjs` 產圖到 `public/intro/`（含略過空白頁、重新編號）。擴充**最後一步**：

1. 確保 `intro-public/` 存在。
2. 清掉 `intro-public/` 內舊的 `page-*.jpg`／`thumb-*.jpg`（避免換版後殘留多餘頁）。
3. 把 `public/intro/` 的 `page-*.jpg`／`thumb-*.jpg` 複製到 `intro-public/`。
4. 複製 `node_modules/page-flip/dist/js/page-flip.module.js` → `intro-public/`。
5. 把整頁圖 `<img>` 清單注入 `intro-public/index.html` 的 `<!--FALLBACK_START-->`／`<!--FALLBACK_END-->` 之間（依目前的 `page-NN.jpg` 產生；既是 no-JS 退路、也是前端 JS 的頁面資料來源）。

`intro-public/index.html` 的版型／樣式／script 為手寫、commit 進站；只有 fallback 區與圖片資產由腳本維護。

---

## 6. 部署（第二個 Cloudflare Pages 專案）

一次性（使用者操作，§9 清單給逐步）：
- Cloudflare → Pages → Create project → 連現有 GitHub repo。
- Framework preset：**None**；Build command：**留空**；Build output directory：**`intro-public`**。
- 部署 → 得 `<專案名>.pages.dev`（例：`jimei-guoyue-intro.pages.dev`）。
- 把該網址放官方 LINE。

之後維護：照常 GitHub Desktop **Push** → 內網 Worker 與公開 Pages **兩個專案各自自動重建**。換介紹：替換 `Reference` PDF → `npm run build:intro`（兩處同步）→ Push。

---

## 7. 隔離與安全

- 公開站與內網是**不同 origin**；公開站無任何內網連結或網址字串 → 內網網域不從公開站洩漏。
- 公開站只含翻頁書必需的靜態資產（圖片＋lib＋邏輯），無公告／文件／幹部資料。
- 內網安全模型不變（仍靠「網址不公開」；本案不替內網加登入）。
- 介紹內容本就對外（招生素材），公開無虞。

---

## 8. 維護與低維護考量

- **單一素材來源**：圖片由 `build:intro` 一次產出、同步 `public/intro/` 與 `intro-public/` 兩處；公開站的頁數由注入的 fallback 清單推導，跟著實際圖片走、不會漂移。
- **可接受的重複**：viewer 的初始化 glue＋HTML 結構＋CSS 會與 `intro.astro` 有一份鏡像（viewer 穩定、極少改）；換得公開站「純靜態、零 build、最不易壞」。改 viewer 行為時兩處都要動——於 `intro-public/index.html` 註明鏡像關係。
- **LINE 預覽快取**：換站名／封面後，舊網址預覽可能延遲更新；加未貼過的參數（如 `?v=2`）或等快取過期。

---

## 9. 待使用者完成（一次性）

1. 確認/產生最新圖片：`npm run build:intro`（pdftocairo 需在 PATH 或設 `PDFTOCAIRO`）。
2. GitHub Desktop **Push**（讓 repo 含 `intro-public/`）。
3. Cloudflare 新增 Pages 專案：連 repo、preset None、build 留空、輸出目錄 `intro-public` → 部署。
4. 取得 `*.pages.dev` 網址，回填 `index.html` 的 `og:image`／`og:url` 絕對網址後再 Push 一次（讓預覽卡片正確）。
5. 把公開網址放官方 LINE。

> 詳步驟於實作階段寫成 `docs/superpowers/plans/2026-06-28-public-intro-go-live-checklist.md`。

---

## 10. 驗收標準

- `intro-public/` 經第二個 Pages 專案部署後，公開網址可正常翻頁（桌機單頁翻、縮圖、放大、全螢幕、手機滑動、no-JS 退路）。
- 公開站**無任何連到內網的連結**、原始碼不含內網網址。
- 官方 LINE 貼公開網址 → 預覽卡片顯示封面＋標題。
- 內網站 `npm run build` 不變、`dist/` 不含 `intro-public/`；站內 `/intro` 與入口卡照舊。
- `npm run build:intro` 後，`public/intro/` 與 `intro-public/` 圖片一致（23 頁）。

---

## 11. 不做（YAGNI）

- 不替內網加登入／權限（維持現有「網址不公開」模型）。
- 不把整個 Astro 站搬成可選擇性公開；只獨立出介紹一頁。
- 公開站不放下載 PDF、不接任何內網資料（公告／文件／支援）。
- 不為公開站另建第二個 git repo（同 repo 子資料夾即可）。
- 不自動化 Cloudflare 專案建立（一次性手動設定）。
