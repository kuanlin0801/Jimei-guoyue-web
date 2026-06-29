# 公告接真實資料上線 — 操作 Checklist

> **目標**：把線上「最新公告」從範例切換成你們的 Google 試算表。本次只**接通管道**（試算表只放表頭、無內容），上線即顯示空狀態，內容日後幹部自行新增。
> **對應設計**：`docs/superpowers/specs/2026-06-25-announcements-go-live-design.md`
> **角色標示**：👤 = 你（會長／幹部，在 Google／Cloudflare 點選操作）；🛠️ = 工程端（我，負責驗證與可選微調）

---

## A. 建立並發布 Google 試算表（👤）

- [ ] **A1** Google 雲端硬碟 → 新增 → Google 試算表，命名如「集美國樂－公告」。
- [ ] **A2** `A1`～`D1` 依序填四欄表頭：**日期、標題、內容、置頂**（順序不可換）。
- [ ] **A3** 點 **A 欄**整欄 → 功能表「格式 → 數值 → 純文字」。
  - *為什麼*：避免 Google 把 `2026-06-25` 自動辨識成日期型態，導致發布的 CSV 輸出變成奇怪格式。
- [ ] **A4** 「檔案 → 共用 → 發布到網路」→「連結」分頁 → 下拉選**這張工作表** → 格式選**逗號分隔值 (.csv)** → 按**發布**。
  - *為什麼*：產生一個任何人可讀的唯讀 CSV 連結（只含這張表、只能讀不能改原檔）。
- [ ] **A5** 複製產生的連結（長得像 `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?…&output=csv`），貼給我。

---

## B. 設定 Cloudflare 環境變數（👤）

- [ ] **B1** Cloudflare → 你的專案 → **Settings → Build → Variables and secrets**。
- [ ] **B2** 在 **build 變數區**（**不是** runtime 那欄）新增：
  - 名稱：`PUBLIC_ANNOUNCEMENTS_CSV`
  - 值：A5 複製的連結
- [ ] **B3** 儲存。

---

## C. 重新部署（👤）

- [ ] **C1** 用 GitHub Desktop 按 **Push** 觸發重建；或在 Cloudflare 對最新一筆 deployment 按 **Retry / Redeploy**。
- [ ] **C2** 等 Cloudflare 顯示部署 **Success**。
  - *為什麼*：`PUBLIC_*` 變數是 build 時才嵌入網頁的，改完一定要重建才生效。

---

## D. 驗證（🛠️ 我來，你把網址給我即可）

- [ ] **D1** 開 `https://jimei-guoyue-web.jmes-ntpc.workers.dev/announcements`，確認顯示「**目前沒有公告。**」（空狀態，正常）。
- [ ] **D2** 看瀏覽器 console，確認**沒有 CORS／fetch 錯誤** ← 本站第一次接 Google CSV，這是最關鍵的檢查。
- [ ] **D3** 臨時在試算表加一列測試（例：日期 `2026-06-25`、標題「測試公告」、內容「這是一筆測試」、**置頂填 `V`**）→ 等 1–5 分鐘（Google 快取）→ 重整頁面 → 確認該筆顯示、置頂排最前、文字不破版。
- [ ] **D4** 驗畢後**刪掉測試列**，回到只有表頭的空狀態。

---

## E. 若 D2 出現 CORS 錯誤 → fallback（🛠️）

- [ ] **E1** 改用 gviz 端點：`https://docs.google.com/spreadsheets/d/<試算表ID>/gviz/tq?tqx=out:csv&sheet=<工作表名>`
  - 試算表ID = 試算表網址 `/d/` 與 `/edit` 之間那段。
  - 需把試算表共用設成「知道連結的人 → 檢視者」。
- [ ] **E2** 把 `PUBLIC_ANNOUNCEMENTS_CSV` 換成 gviz 連結 → 重新部署 → 回 D2 再驗。

---

## F. 可選微調（🛠️，視驗證結果，本次不一定做）

- [ ] **F1** 公告頁「即時同步」文案調整（published CSV 有數分鐘快取，非真的即時）。
- [ ] **F2** `fetchAnnouncements` 加 `{ cache: 'no-store' }` 降低瀏覽器端快取。

---

**完成後**：管道即接通。日後幹部只要在試算表**加一列、存檔**，幾分鐘後重整公告頁就會出現；**置頂欄填 `V`** 可把該則釘在最上。
