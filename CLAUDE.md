# 集美國小國樂團 社團資訊網站

## 專案概述
集美國小國樂團（學生家長社團）的**對內資訊網站**，定位為「長期資訊倉庫」——行事曆、公告、文件、師資、活動支援集中於此；LINE 繼續做即時溝通。會長為發起人之配偶。設計／實作計畫見 `docs/superpowers/`。

## 技術棧
- **Astro**（靜態網站產生器）＋ 原生 HTML/CSS/JS
- **vitest** 單元測試（只測 `src/lib/` 的純邏輯）
- 會頻繁變動的資料外接 **Google 工具**（日曆 iframe；公告、文件下載與活動支援看板讀「Google 試算表發布的 CSV」；相簿連 Google 相簿）——讓非技術幹部零程式即可更新

## 常用指令
- `npm run dev` — 開發伺服器（http://localhost:4321）
- `npm run build` — 建置到 `dist/`（部署與驗證標準）
- `npm test` — 跑 vitest 單元測試

## 目錄結構
- `src/pages/*.astro` — 各頁：index（首頁）、calendar、announcements、support（活動支援）、about（關於我們）、documents、gallery（相簿）、achievements（成果）
- `src/layouts/Layout.astro` — 共用版型；含 `<title>`、`description` 與連結預覽用的 Open Graph／Twitter Card meta（`og:image` 為站上 `logo.png`，需 `astro.config.mjs` 的 `site` 才能產生絕對網址）。首頁不傳 `title`，故標題僅「集美國小國樂團」；其餘頁為「XXX｜集美國小國樂團」。
- `src/components/` — Header.astro（淺色 header＋左上 logo 品牌＋導覽）、Footer.astro（頁尾聯絡）
- `src/lib/` — 純邏輯：`csv.js`（splitCsvLine／parseCsvRows／isSafeHref）、`announcements.js`、`documents.js`、`support.js`，各有 `*.test.js`
- `src/data/*.js` — 半靜態內容資料檔：club、teachers、officers、albums、achievements、support-events
- `src/styles/global.css` — 全站配色：主色**竹綠 `--brand` #1F7A4D**（取自 logo）＋ 金 `--gold` ＋ 宣紙底 `--paper`
- `public/` — 靜態資源：`logo.png`（已去背）、`sample-*.csv`（開發範例資料）
- `docs/superpowers/` — 設計 spec 與 Phase 1/2 實作計畫
- `Reference/` — 使用者提供的原始素材（logo 原檔、師資 docx），非建置用

## 重要慣例
- **commit 訊息**沿用全域 KyymmddX 格式，專案標籤 `[JimeiGuoyue]`；**每次 commit 前需先讓使用者確認**。
- ⚠️ **本專案是網頁專案，不套用全域 CLAUDE.md 的 BIOS 行內程式碼 tag 規則**（`//KyymmddX+` 等）。Astro/JS 程式碼保持乾淨、不嵌 tag；只有 commit 訊息用 KyymmddX。
- **低維護原則**：會動的資料一律走 Google 工具（CSV／iframe／連結）；不常變的內容放 `src/data/*.js`。
- **開發用範例資料**：`public/sample-*.csv` 與 `src/data` 的「（範例）」內容讓無真實素材也能開發；上線前依檢查表替換。
- 公告／文件下載／看板在瀏覽器端 fetch CSV → 一律用 `esc()` 跳脫後再組 `innerHTML`（防 XSS）；外部連結另用 `isSafeHref` 擋 `javascript:` 等注入。

## 部署
- 已上線：**https://jimei-guoyue-web.kuan-lin.workers.dev**（Cloudflare，與 GitHub 連動）
- 流程：在 **GitHub Desktop 按 Push** → Cloudflare 自動 `npm run build` 重新部署，**不需手動操作 Cloudflare**。⚠️ 正式站從 **`main`** 部署；功能分支的修改要等併入 `main` 才會上線。
- ⚠️ **連結預覽快取**：LINE／Messenger 等聊天 App 會快取每個網址的預覽卡片（抓 `<title>`／OG meta）。改了站名／標題後，舊網址可能仍顯示舊文字；要立即看到新版就在網址後加沒貼過的參數（如 `?v=3`）或等其快取過期。`astro.config.mjs` 已設 `site`。
- **環境變數**（皆為 Astro build 時嵌入的 `PUBLIC_*`）：設在 Cloudflare **Settings → Build → Variables and secrets**（build 變數區，**非** runtime 那欄——靜態資產 Worker 的 runtime 變數是鎖住的）；改完需**重新部署**才生效。
  - `PUBLIC_GOOGLE_API_KEY`：首頁「近期行程」讀 Google Calendar API 用（限本站 referrer＋只開 Calendar API、唯讀）。**已設定** ✓
  - `PUBLIC_ANNOUNCEMENTS_CSV`：公告真實來源（未設則 fallback `/sample-announcements.csv`）。**已設定** ✓ → 線上「最新公告」已切到社團公告試算表（published CSV，含「置頂」欄）；本次只接通管道，試算表暫只有表頭故線上顯示空狀態。⚠️ Google 對 published CSV 有 `max-age=300` 快取，幹部更新後約 5 分鐘內才反映。公告試算表現可選填 `附件名稱`/`附件連結` 兩欄（公告附件功能）。
  - `PUBLIC_DOCUMENTS_CSV`：文件下載頁的「文件試算表」CSV（未設則 fallback `/sample-documents.csv`）；文件下載頁另讀公告 CSV 抽出附件合併顯示。**尚未設定**（線上文件頁目前顯示範例文件＋公告附件）。

## 目前狀態 / 待辦
- Phase 1（首頁／行事曆／公告／關於我們／文件下載）＋ Phase 2（活動支援報名＋公開看板／相簿／成果）皆**完成並上線**。視覺為竹綠主題、去背 logo 置左上、淺色 header。
- **師資**已是真實資料 ✓（核心團隊／各分部／國樂三團）。
- **連結預覽 meta** 已上線 ✓（`Layout.astro` 加 Open Graph／Twitter Card＋`canonical`、`astro.config.mjs` 設 `site`；分享卡片含 logo 縮圖、標題為「集美國小國樂團」）。首頁標題已移除「首頁」前綴。
- **行事曆**已接上三個社團 Google 日曆 ✓（國樂團／古箏提琴／暑訓，合併單一檢視＋顏色圖例；以 `src/data/calendars.js` 單一來源管理，各日曆已設公開「查看完整內容」）。
- **首頁近期行程**已上線 ✓（前端讀 Google Calendar API 顯示未來 5 筆；純邏輯在 `src/lib/events.js`＋vitest，未設金鑰時 fallback `src/data/sample-events.js`）。設計見 `docs/superpowers/specs/2026-06-25-home-upcoming-events-design.md`。
- **公告**已接真實公告試算表 ✓（瀏覽器端 fetch published CSV → `esc()` 防 XSS、置頂欄填 `V`；本次只接通管道、試算表暫只有表頭故顯示空狀態）。設計見 `docs/superpowers/specs/2026-06-25-announcements-go-live-design.md`、操作清單 `docs/superpowers/plans/2026-06-25-announcements-go-live-checklist.md`。
- **公告附件＋文件下載整合**：程式完成 ✓（公告可夾帶一個 Google Drive 附件、點擊開啟，並自動與常設文件一起出現在改為動態的文件下載頁；置頂最前其餘依日期；外部 CSV 連結經 `isSafeHref` 防 `javascript:` 注入。純邏輯 `src/lib/documents.js`＋vitest）。設計／計畫見 `docs/superpowers/`（`*-announcement-attachments*`）。⚠️ **上線待使用者操作**：公告試算表加 `附件名稱/附件連結` 兩欄、建「文件試算表」（日期/名稱/連結/類型/備註/置頂）、設 `PUBLIC_DOCUMENTS_CSV` 並重新部署。
- **待補真實素材**：
  - `src/data/officers.js`：家長幹部（會長等）真實姓名（目前佔位）
  - `src/components/Footer.astro`：學校全名、聯絡窗口、Email（目前佔位）
  - Google 連結：活動支援表單與回覆 CSV（`support-events.js`）、相簿（`albums.js`）、成果（`achievements.js`）
- Phase 3（尚未做）：練習資源、常見問題 FAQ。
