# 集美國小國樂團 社團資訊網站

## 專案概述
集美國小國樂團（學生家長社團）的**對內資訊網站**，定位為「長期資訊倉庫」——行事曆、公告、文件、師資、活動支援集中於此；LINE 繼續做即時溝通。會長為發起人之配偶。設計／實作計畫見 `docs/superpowers/`。

## 技術棧
- **Astro**（靜態網站產生器）＋ 原生 HTML/CSS/JS
- **vitest** 單元測試（只測 `src/lib/` 的純邏輯）
- 會頻繁變動的資料外接 **Google 工具**（日曆 iframe；公告與活動支援看板讀「Google 試算表發布的 CSV」；相簿連 Google 相簿）——讓非技術幹部零程式即可更新

## 常用指令
- `npm run dev` — 開發伺服器（http://localhost:4321）
- `npm run build` — 建置到 `dist/`（部署與驗證標準）
- `npm test` — 跑 vitest 單元測試

## 目錄結構
- `src/pages/*.astro` — 各頁：index（首頁）、calendar、announcements、support（活動支援）、about（關於我們）、documents、gallery（相簿）、achievements（成果）
- `src/layouts/Layout.astro` — 共用版型
- `src/components/` — Header.astro（淺色 header＋左上 logo 品牌＋導覽）、Footer.astro（頁尾聯絡）
- `src/lib/` — 純邏輯：`csv.js`（splitCsvLine／parseCsvRows）、`announcements.js`、`support.js`，各有 `*.test.js`
- `src/data/*.js` — 半靜態內容資料檔：club、teachers、officers、documents、albums、achievements、support-events
- `src/styles/global.css` — 全站配色：主色**竹綠 `--brand` #1F7A4D**（取自 logo）＋ 金 `--gold` ＋ 宣紙底 `--paper`
- `public/` — 靜態資源：`logo.png`（已去背）、`sample-*.csv`（開發範例資料）
- `docs/superpowers/` — 設計 spec 與 Phase 1/2 實作計畫
- `Reference/` — 使用者提供的原始素材（logo 原檔、師資 docx），非建置用

## 重要慣例
- **commit 訊息**沿用全域 KyymmddX 格式，專案標籤 `[JimeiGuoyue]`；**每次 commit 前需先讓使用者確認**。
- ⚠️ **本專案是網頁專案，不套用全域 CLAUDE.md 的 BIOS 行內程式碼 tag 規則**（`//KyymmddX+` 等）。Astro/JS 程式碼保持乾淨、不嵌 tag；只有 commit 訊息用 KyymmddX。
- **低維護原則**：會動的資料一律走 Google 工具（CSV／iframe／連結）；不常變的內容放 `src/data/*.js`。
- **開發用範例資料**：`public/sample-*.csv` 與 `src/data` 的「（範例）」內容讓無真實素材也能開發；上線前依檢查表替換。
- 公告／看板在瀏覽器端 fetch CSV → 一律用 `esc()` 跳脫後再組 `innerHTML`（防 XSS）。

## 部署
- 已上線：**https://jimei-guoyue-web.kuan-lin.workers.dev**（Cloudflare，與 GitHub 連動）
- 流程：在 **GitHub Desktop 按 Push** → Cloudflare 自動 `npm run build` 重新部署，**不需手動操作 Cloudflare**。
- 公告真實來源：於 Cloudflare 環境變數設 `PUBLIC_ANNOUNCEMENTS_CSV`（未設則 fallback 至 `/sample-announcements.csv`）。

## 目前狀態 / 待辦
- Phase 1（首頁／行事曆／公告／關於我們／文件下載）＋ Phase 2（活動支援報名＋公開看板／相簿／成果）皆**完成並上線**。視覺為竹綠主題、去背 logo 置左上、淺色 header。
- **師資**已是真實資料 ✓（核心團隊／各分部／國樂三團）。
- **行事曆**已接上三個社團 Google 日曆 ✓（國樂團／古箏提琴／暑訓，合併單一檢視＋顏色圖例；以 `calendar.astro` 的 `calendars` 陣列管理，各日曆已設公開「查看完整內容」）。
- **待補真實素材**：
  - `src/data/officers.js`：家長幹部（會長等）真實姓名（目前佔位）
  - `src/components/Footer.astro`：學校全名、聯絡窗口、Email（目前佔位）
  - Google 連結：公告試算表（需含「置頂」欄）、活動支援表單與回覆 CSV（`support-events.js`）、相簿（`albums.js`）、成果（`achievements.js`）
- Phase 3（尚未做）：練習資源、常見問題 FAQ。
