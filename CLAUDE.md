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
- `src/pages/*.astro` — 各頁：index（首頁）、calendar、announcements、support（活動支援）、about（關於我們）、documents、gallery（相簿）、achievements（成果）、intro（樂團介紹翻頁書）
- `src/layouts/Layout.astro` — 共用版型；含 `<title>`、`description` 與連結預覽用的 Open Graph／Twitter Card meta（`og:image` 為站上 `logo.png`，需 `astro.config.mjs` 的 `site` 才能產生絕對網址）。首頁不傳 `title`，故標題僅「集美國小國樂團」；其餘頁為「XXX｜集美國小國樂團」。
- `src/components/` — Header.astro（毛玻璃 sticky header＋左上 logo 雙行品牌＋膠囊導覽，≤720px 漢堡下拉選單）、Footer.astro（深棕頁尾聯絡＋LINE QR）、PageHero.astro（子頁共用頁首：小字 eyebrow＋主標＋副標）
- `src/lib/` — 純邏輯：`csv.js`（splitCsvLine／parseCsvRows／isSafeHref）、`announcements.js`、`documents.js`、`support.js`、`flipbook.js`（翻頁書頁面清單／頁碼），各有 `*.test.js`
- `src/data/*.js` — 半靜態內容資料檔：club、teachers、officers、albums、achievements、support-events
- `src/styles/global.css` — 全站視覺 token＋共用樣式（1c「水彩雅集」風）：主色**竹綠 `--brand` #1F7A4D**＋金 `--gold`＋朱印紅 `--seal`＋墨棕 `--ink`＋米色底 `--paper` #FBF6EC＋`--faint`／`--line-soft`／`--chip`；卡片、膠囊鈕、區段輪替色圓點標題、`.page-hero` 等共用 class 也集中於此
- `public/` — 靜態資源：`logo.png`（已去背）、`sample-*.csv`（開發範例資料）、`intro/`（樂團介紹翻頁書整頁圖＋縮圖）
- `worker/` — 內網密碼閘 Worker：`index.js`（gate handler）、`auth.js`／`login-page.js`（純邏輯＋模板，各有 `*.test.js`）
- `scripts/build-intro-images.mjs` — 用 `pdftocairo` 把介紹 PDF 轉成翻頁書圖片（`npm run build:intro`）；本機開發步驟，產出 commit 進站。並同步圖片＋page-flip 函式庫到 `intro-public/`、注入其 no-JS 退路清單
- `intro-public/` — **對外公開**的獨立翻頁站（純靜態、無導覽列、無內網連結；給官方 LINE）。不被 Astro build 收錄，由**另一個 Cloudflare Worker（靜態資產）**部署成不同網址（含 `wrangler.jsonc`；見「部署」段）
- `docs/superpowers/` — 設計 spec 與 Phase 1/2 實作計畫
- `Reference/` — 使用者提供的原始素材（logo 原檔、師資 docx），非建置用

## 重要慣例
- **commit 訊息**沿用全域 KyymmddX 格式，專案標籤 `[JimeiGuoyue]`；**每次 commit 前需先讓使用者確認**。
- ⚠️ **本專案是網頁專案，不套用全域 CLAUDE.md 的 BIOS 行內程式碼 tag 規則**（`//KyymmddX+` 等）。Astro/JS 程式碼保持乾淨、不嵌 tag；只有 commit 訊息用 KyymmddX。
- **低維護原則**：會動的資料一律走 Google 工具（CSV／iframe／連結）；不常變的內容放 `src/data/*.js`。
- **開發用範例資料**：`public/sample-*.csv` 與 `src/data` 的「（範例）」內容讓無真實素材也能開發；上線前依檢查表替換。
- 公告／文件下載／看板在瀏覽器端 fetch CSV → 一律用 `esc()` 跳脫後再組 `innerHTML`（防 XSS）；外部連結另用 `isSafeHref` 擋 `javascript:` 等注入。

## 部署
- 已上線：**https://jimei-guoyue-web.jmes-ntpc.workers.dev**（Cloudflare，與 GitHub 連動）
- **內網密碼閘**：主站由 `wrangler.jsonc`＋`worker/`（`run_worker_first` 密碼閘）部署——全團共用密碼（LINE 群公告）、cookie 記住 30 天、密碼頁帶 OG meta 保 LINE 預覽；放行 logo／favicon／robots.txt。兩個 runtime secret：`SITE_PASSWORD`（共用密碼）、`COOKIE_SECRET`（簽章金鑰，換掉＝全員登出）。⚠️ Deploy command 為 `npx wrangler deploy`（非預設靜態資產部署）；本機測閘：`npm run build` 後 `npx wrangler dev`（secrets 在 `.dev.vars`，不入庫）。上線步驟見 `docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md`。
- 流程：在 **GitHub Desktop 按 Push** → Cloudflare 自動 `npm run build` 重新部署，**不需手動操作 Cloudflare**。⚠️ 正式站從 **`main`** 部署；功能分支的修改要等併入 `main` 才會上線。
- **對外公開版介紹**已上線 ✓ **https://jimei-guoyue-intro.jmes-ntpc.workers.dev**——**第二個 Cloudflare Worker（靜態資產）**，從同 repo 的 `intro-public/` 部署（Root directory `intro-public`、Build 留空、Deploy `npx wrangler deploy`，設定檔 `intro-public/wrangler.jsonc`）。與內網不同網址、放官方 LINE，避免曝光內網。一次 Push、兩站各自自動更新（注意：本帳號無獨立 Pages 入口，靜態站走 Workers）。設定見 `docs/superpowers/plans/2026-06-28-public-intro-go-live-checklist.md`。
- ⚠️ **連結預覽快取**：LINE／Messenger 等聊天 App 會快取每個網址的預覽卡片（抓 `<title>`／OG meta）。改了站名／標題後，舊網址可能仍顯示舊文字；要立即看到新版就在網址後加沒貼過的參數（如 `?v=3`）或等其快取過期。`astro.config.mjs` 已設 `site`。
- **環境變數**（皆為 Astro build 時嵌入的 `PUBLIC_*`）：設在 Cloudflare **Settings → Build → Variables and secrets**（build 變數區，**非** runtime 那欄——靜態資產 Worker 的 runtime 變數是鎖住的）；改完需**重新部署**才生效。
  - `PUBLIC_GOOGLE_API_KEY`：首頁「近期行程」讀 Google Calendar API 用（限本站 referrer＋只開 Calendar API、唯讀）。**已設定** ✓ ⚠️ **改網址／Workers 子網域後務必同步更新這把金鑰的 HTTP referrer 白名單**（Google Cloud Console → API 和服務 → 憑證 → 此金鑰 → HTTP 參照網址，新增 `https://<新網址>/*`），否則首頁變「行程載入失敗」（所有日曆請求被 Google 擋 403）。K260629 子網域改 jmes-ntpc 後即因白名單未更新而中斷，補加新網址後恢復。
  - `PUBLIC_ANNOUNCEMENTS_CSV`：公告真實來源（未設則 fallback `/sample-announcements.csv`）。**已設定** ✓ → 線上「最新公告」已切到社團公告試算表（published CSV，含「置頂」欄）；本次只接通管道，試算表暫只有表頭故線上顯示空狀態。⚠️ Google 對 published CSV 有 `max-age=300` 快取，幹部更新後約 5 分鐘內才反映。公告試算表現可選填 `附件名稱`/`附件連結` 兩欄（公告附件功能）。
  - `PUBLIC_DOCUMENTS_CSV`：文件下載頁的「文件試算表」CSV（未設則 fallback `/sample-documents.csv`）；文件下載頁另讀公告 CSV 抽出附件合併顯示。**尚未設定**（線上文件頁目前顯示範例文件＋公告附件）。
  - `PUBLIC_SUPPORT_API_URL`＋`PUBLIC_SUPPORT_TOKEN`：活動支援的 Apps Script Web App 網址（看板即時讀 `doGet`＋站內報名寫 `doPost`）與送出用共用 token。未設則 fallback 讀 `public/sample-support-*.csv`。**Apps Script 已部署** ✓（`/exec` 回 JSON 正常）；環境變數已填、待本次 build 生效後線上支援頁改讀真實試算表。另可選填 `PUBLIC_SUPPORT_ACTIVITIES_CSV`／`PUBLIC_SUPPORT_JOBS_CSV`／`PUBLIC_SUPPORT_RESPONSES_CSV` 作為 `doGet` 失敗時的後備。操作見 `docs/superpowers/plans/2026-06-26-support-go-live-checklist.md`。

## 目前狀態 / 待辦
- Phase 1（首頁／行事曆／公告／關於我們／文件下載）＋ Phase 2（活動支援報名＋公開看板／相簿／成果）皆**完成並上線**。
- **內網密碼閘**已實作 ✓（全團共用密碼、每月輸入一次、fail-closed、noindex 基線；設計 `docs/superpowers/specs/2026-07-02-password-gate-design.md`）。⚠️ **上線待使用者操作**：改 Deploy command、設 `SITE_PASSWORD`／`COOKIE_SECRET` 兩個 runtime secret——步驟見 `docs/superpowers/plans/2026-07-02-password-gate-go-live-checklist.md`。
- **全站視覺改版 1c「水彩雅集」** ✓（K260630A）：依 `Reference/集美國樂團網站介面優化/design_handoff_1c_redesign/` 設計稿把視覺層全面換新——米色底（`--paper` #FBF6EC）＋書法 hero 大標（Ma Shan Zheng「童心奏古音」，僅首頁用；註：Ma Shan Zheng 是簡體字型，未收繁體「韻」「樂」會掉系統黑體，故末字選繁簡同形、字型有收的「音」）＋膠囊導覽（手機 ≤720px 漢堡下拉）＋柔和圓角白卡＋區段輪替色（竹綠→金→朱紅）圓點標題；去背 logo 仍置左上。tokens／共用樣式集中在 `global.css`，子頁頁首抽成 `PageHero.astro`。**只動視覺層**：資料流（Calendar API／published CSV／Apps Script `doGet/doPost`／輪詢與樂觀更新）與 `src/lib/` 純邏輯及 vitest 全未動。原型對照驗證見記憶 `jimei-preview-verify`（build 後 `npm run preview` 靜態截圖）。
- **站台用詞統一「樂團」** ✓（K260629C）：訪客可見文字不再用「社團」（關於我們、行事曆、內外網翻頁書標題等）；程式碼註解仍保留「社團」描述這個家長社團組織。K260630A 再調整：首頁 hero 副標改為「集美國小國樂團後援會——把每一次練習、演出與相聚，溫柔地收藏。」；「最新公告」統一簡稱「公告」（導覽分類、首頁按鈕、公告內頁 H1 與分頁標題），首頁 hero 兩鈕為「看公告」（→/announcements）／「看行事曆」（→/calendar）。
- **活動相簿暫時隱藏** ✓（K260629C）：目前無內容需求，已從導覽列（`Header.astro`）移除「活動相簿」項；`gallery.astro`／`albums.js` 保留不刪，恢復＝把 nav 的 `/gallery` 那行加回。
- **師資**已是真實資料 ✓（核心團隊／各分部／國樂三團）。
- **連結預覽 meta** 已上線 ✓（`Layout.astro` 加 Open Graph／Twitter Card＋`canonical`、`astro.config.mjs` 設 `site`；分享卡片含 logo 縮圖、標題為「集美國小國樂團」）。首頁標題已移除「首頁」前綴。
- **行事曆**已接上四個社團 Google 日曆 ✓（全團常態課與展演／加強課／低音組分部課／暑期集訓，合併單一檢視＋顏色圖例；以 `src/data/calendars.js` 單一來源管理，各日曆需設公開「查看完整內容」）。四個日曆名稱於 6/28 由幹部更新（K260628D 同步）；「加強課」為 6/28 新增，其公開設定待確認。
- **首頁近期行程**已上線 ✓（前端讀 Google Calendar API 顯示未來 5 筆；純邏輯在 `src/lib/events.js`＋vitest，未設金鑰時 fallback `src/data/sample-events.js`）。設計見 `docs/superpowers/specs/2026-06-25-home-upcoming-events-design.md`。
- **公告**已接真實公告試算表 ✓（瀏覽器端 fetch published CSV → `esc()` 防 XSS、置頂欄填 `V`；本次只接通管道、試算表暫只有表頭故顯示空狀態）。設計見 `docs/superpowers/specs/2026-06-25-announcements-go-live-design.md`、操作清單 `docs/superpowers/plans/2026-06-25-announcements-go-live-checklist.md`。
- **公告附件＋文件下載整合**：程式完成 ✓（公告可夾帶一個 Google Drive 附件、點擊開啟，並自動與常設文件一起出現在改為動態的文件下載頁；置頂最前其餘依日期；外部 CSV 連結經 `isSafeHref` 防 `javascript:` 注入。純邏輯 `src/lib/documents.js`＋vitest）。設計／計畫見 `docs/superpowers/`（`*-announcement-attachments*`）。⚠️ **上線待使用者操作**：公告試算表加 `附件名稱/附件連結` 兩欄、建「文件試算表」（日期/名稱/連結/類型/備註/置頂）、設 `PUBLIC_DOCUMENTS_CSV` 並重新部署。
- **活動支援（站內即時報名／認領）**已實作 ✓（兩型——接龍湊人手／分工認領——共用同一資料模型；家長站內填稱呼直接送出、看板即時更新；活動由 Google 試算表「活動／工作／報名」三分頁驅動，幹部加列即可新增活動；讀走 Apps Script `doGet`＋CSV 後備、寫走 `doPost`；純邏輯 `src/lib/support.js`＋vitest；舊 `src/data/support-events.js` 已移除）。設計 `docs/superpowers/specs/2026-06-26-support-live-signup-design.md`、計畫 `docs/superpowers/plans/2026-06-26-support-live-signup.md`、上線清單 `docs/superpowers/plans/2026-06-26-support-go-live-checklist.md`、後端參考 `apps-script/support.gs`。⚠️ **上線待使用者操作**：建三分頁試算表、部署 Apps Script、設 `PUBLIC_SUPPORT_API_URL`／`PUBLIC_SUPPORT_TOKEN` 並重新部署。
- **成果與榮譽**已是真實資料 ✓（從社團 FB 粉專逐張得獎／活動海報核對整理；`src/data/achievements.js` 拆成 `performances`／`teamAwards`／`soloAwardGroups` 三組，`achievements.astro` 分「競賽榮譽」「演出紀錄」兩區、名次用金銀銅 badge、各列固定 badge 欄對齊）。涵蓋絲竹合奏特優／優等第一名（113）等團體獎、卓越盃與全國器樂大賽北區等個人獎，及 2024–2026 共 11 場演出。⚠️ 樂團史其實可回溯 111 學年度（2022），早於粉專簡介「2024 全新登場」的行銷說法；目前依使用者選擇只列 2024 起，更早成果（如 111 傳統藝術盃擊鼓特優、2022 音樂會）尚未納入，未來可補。
- **樂團介紹翻頁書**已上線 ✓（`/intro`：團員設計的介紹 PDF 自建翻頁電子書（23 頁，原 25 頁已移除 2 頁空白），取代需付費解鎖的外部 fliphtml5；StPageFlip 單頁翻＋上下頁／頁碼／縮圖跳頁／放大／全螢幕，關閉 JS 時退化為整頁圖清單。圖片用 `pdftocairo` 轉出放 `public/intro/`、由 `npm run build:intro`（`scripts/build-intro-images.mjs`）產生；入口卡放「關於我們」頁、導覽列不變。純邏輯 `src/lib/flipbook.js`＋vitest）。設計／計畫見 `docs/superpowers/`（`*-club-intro-flipbook*`）。更新介紹：換 `Reference/集美國小國樂介紹.pdf` → `npm run build:intro`（pdftocairo 需在 PATH 或設 `PDFTOCAIRO`）→ push。
- **對外公開版介紹**已實作 ✓（`intro-public/`：與內網**不同網址**的獨立純靜態翻頁站，供官方 LINE——本站為內網，直接貼內網網址會曝光整個內網。自包覆、無導覽列、無內網連結；含 OG 預覽 meta；page-flip 用 module build 原生 import、頁面清單由注入的 no-JS 退路推導；`build:intro` 一併同步圖片＋函式庫並注入清單）。設計／計畫見 `docs/superpowers/`（`*-public-intro-site*`），上線清單 `docs/superpowers/plans/2026-06-28-public-intro-go-live-checklist.md`。**已上線 ✓ https://jimei-guoyue-intro.jmes-ntpc.workers.dev**（第二個 Cloudflare Worker／靜態資產，從 `intro-public/` 部署、設定檔 `intro-public/wrangler.jsonc`、Root directory `intro-public`、無 build；本帳號無 Pages 入口故走 Workers）。
- **後援會幹部**（原稱家長幹部，K260702C 改名）已是真實名單 ✓（K260702：會長趙芃＋副會長群兼任各組組長共七組；`officers.js` 拆 `president`／`officerGroups`，關於我們頁改**階層式卡片**——會長卡置頂＋短接線＋「副會長群（兼任各組組長）」說明＋各組卡片（組名 chip＋名字置中）；招生組虛線卡「熱情招募中」；謝伊婷兼總務組與社群小編組、依使用者選擇各佔一卡）。
- **待補真實素材**：
  - `src/components/Footer.astro`：聯絡窗口（黃子玉 0968230563）＋ LINE QR（`public/line-qr.jpg`，取代原 Email）已填 ✓；僅「學校全名」一行依使用者選擇暫不放、未定
  - Google 相簿連結（`albums.js`）；⚠️ 相簿目前已從導覽列隱藏（見上「活動相簿暫時隱藏」），待有真實相簿再填連結並恢復導覽
- Phase 3（尚未做）：練習資源、常見問題 FAQ。
