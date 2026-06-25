# 公告接真實資料上線（Google 試算表 CSV）— 設計文件（Design Spec）

- **日期**：2026-06-25
- **狀態**：設計定稿，待進入實作
- **關聯**：補完 `2026-06-23-jimei-guoyue-club-website-design.md` 中「最新公告」一塊——程式碼已完成並上線，本文件處理「接通真實資料來源」這一步。

---

## 1. 背景與目標

公告頁 `src/pages/announcements.astro` 與純邏輯 `src/lib/announcements.js` 早已完成並上線：瀏覽器端 fetch CSV → `esc()` 跳脫防 XSS → 渲染卡片，支援「📌 置頂」。資料來源走環境變數 `PUBLIC_ANNOUNCEMENTS_CSV`，**未設時 fallback 到 `/sample-announcements.csv`**。

目前 `PUBLIC_ANNOUNCEMENTS_CSV` **未設定** → 線上「最新公告」仍是範例資料。

**目標**：把線上公告從範例切換成你們自家的 **Google 試算表**。本次只**接通管道**——試算表只放表頭、不放內容；日後幹部在試算表加一列、（等快取刷新後）重整頁面就會出現。**這是本站第一個真的接 Google CSV 的功能**（行事曆是 iframe 嵌入、活動支援尚未接），因此「瀏覽器端能否跨域 fetch published CSV」需在驗證階段實測。

---

## 2. 核心設計決策

| 項目 | 結論 | 說明 |
|---|---|---|
| 資料來源 | **Google 試算表「發布到網路 → CSV」** | 幹部零程式即可維護；符合低維護原則 |
| 本次範圍 | **只接通管道（表頭、無內容）** | 上線即顯示空狀態，內容日後幹部自行新增 |
| 試算表建立 | **使用者手動建 ＋ 我提供範本** | 試算表須在你們帳號下供幹部維護；不用 MCP 代建（發布步驟仍須手動，省不了又多不確定性） |
| 環境變數 | **`PUBLIC_ANNOUNCEMENTS_CSV`** | 設在 Cloudflare Settings → Build → Variables；改後需重新部署 |
| 程式碼 | **預期不改** | env／解析／空狀態都現成；唯 CORS fallback 或文案準確性可能微調（見 §6、§9） |

---

## 3. 試算表結構

第一列為表頭，**四欄、順序不可換**——程式 `parseAnnouncementsCsv` 是照**欄位位置**讀（`cols[0..3]`），不是照欄名讀，欄名文字只是給幹部看：

| 日期 | 標題 | 內容 | 置頂 |
|------|------|------|------|

- **日期**：建議 `2026-06-25`（`YYYY-MM-DD`）。⚠️ **坑**：Google Sheets 預設會把這種字串自動辨識成「日期型態」，發布 CSV 時可能輸出成 locale 樣式（如 `6/25/2026`）或序列值。對策：先把整個日期欄設成「格式 → 數值 → 純文字」再輸入。程式只把日期當字串顯示、不解析，所以只要 CSV 輸出穩定一致即可。
- **標題 / 內容**：純文字；含逗號或引號時 Google 發布的 CSV 會自動加引號跳脫，`splitCsvLine` 已正確處理。
- **置頂**：填 `V`（或任何非空字、`是`、`★`、`1`…都算）= 置頂並排到最前；**留空** = 一般公告。判定邏輯見 `isPinnedMark`（空白與 `否/n/no/0/false` 視為不置頂）。

---

## 4. 資料流（沿用現有，不變）

```
build 時：Astro 把 import.meta.env.PUBLIC_ANNOUNCEMENTS_CSV 嵌入前端
client 端（瀏覽器，頁面載入時）：
  url = PUBLIC_ANNOUNCEMENTS_CSV || '/sample-announcements.csv'
  fetchAnnouncements(url) → parseAnnouncementsCsv(text)
    → 跳過第一列表頭、略過空白行 → [{date,title,body,pinned}]
  pinnedFirst(items) → 置頂排前
  esc() 跳脫後組 innerHTML 注入 #announcements
```

- **只有表頭時**：迴圈從 i=1 起、無資料列 → 回傳 `[]` → 頁面顯示空狀態（見 §5）。✓ 已驗證符合現有程式。
- published CSV 第一列即表頭 → 被 `parseAnnouncementsCsv` 跳過。✓

---

## 5. 上線後行為（空狀態）

因本次只放表頭，線上公告頁會從現在的「3 則範例」變成顯示：

> **目前沒有公告。**

這是 `announcements.astro` 既有的空狀態分支（`items.length ? … : '<p class="muted">目前沒有公告。</p>'`），屬正常行為。**使用者已確認接受**。等幹部在試算表新增第一列、重整頁面即會顯示。

---

## 6. 技術風險與對策

| 風險 | 說明 | 對策 |
|---|---|---|
| **CORS（最關鍵）** | 公告是瀏覽器端 fetch。Google「發布到網路」的 `…/pub?output=csv` 連結能否被本站網域跨域 fetch，須**實測**（本站首次接 Google CSV） | 驗證階段在線上（或本機 dev）實際開公告頁看 console。若被 CORS 擋 → fallback 改用 gviz 端點 `https://docs.google.com/spreadsheets/d/<試算表ID>/gviz/tq?tqx=out:csv&sheet=<工作表名>`（對 CORS 較友善，需試算表設「知道連結的人可檢視」）。**程式只換 URL 來源、邏輯不動** |
| **日期欄自動轉型** | 見 §3 | 日期欄設純文字 |
| **published CSV 快取延遲** | Google 對發布內容有 CDN 快取，幹部改試算表後 published CSV 可能延遲數分鐘才更新；瀏覽器端亦可能快取 | 屬可接受延遲。**注意**：`announcements.astro` 第 6 行文案寫「資料即時同步…重整頁面即可看到」，接真實資料後「即時」不再精確；列為 §9 可選微調 |

---

## 7. 操作步驟（SOP，我會另寫成 checklist 放 `docs/`）

1. **建立試算表**：Google 雲端硬碟 → 新增 Google 試算表，命名（如「集美國樂－公告」）。
2. **填表頭**：A1:D1 依序填 `日期`、`標題`、`內容`、`置頂`。
3. **日期欄設純文字**：選 A 整欄 → 格式 → 數值 → 純文字。
4. **發布**：檔案 → 共用 → 發布到網路 → 連結 → 選該工作表 ＋ 「逗號分隔值 (.csv)」→ 發布 → 複製連結。
5. **設環境變數**：Cloudflare → 專案 → Settings → Build → Variables and secrets → 新增 build 變數 `PUBLIC_ANNOUNCEMENTS_CSV` = 上一步連結。
6. **重新部署**：GitHub Desktop Push 觸發，或 Cloudflare 對最新 deployment 按 Retry/Redeploy。
7. **驗證**：見 §8。

---

## 8. 驗收標準

- 線上公告頁 `/announcements` 載入**無 console error**（特別是 **CORS** 錯誤）。
- 接通後頁面顯示「目前沒有公告。」（空狀態，符合本次範圍）。
- 臨時在試算表加一列測試公告（含一筆填 `V` 置頂）→ 等快取刷新後重整 → 該列正確顯示、置頂排最前、特殊字元不破版 → 驗畢後刪除測試列。
- 若改用 gviz fallback：上述驗證同樣通過。
- `npm run build` 無誤（理論上不動程式碼，僅確認）。

---

## 9. 程式碼影響與可選微調

- **本次預期不改任何程式碼**——純設定 ＋ 操作。
- **可選微調（視驗證結果，本次不一定做）**：
  - CORS fallback → 改 `announcements.astro` 取 URL 的來源（換 gviz 連結，可直接設進環境變數，未必改 code）。
  - 文案準確性 → `announcements.astro` 第 6 行「即時同步」改為「幹部更新後數分鐘內會反映」之類。
  - 降低瀏覽器端快取 → `fetchAnnouncements` 加 `{ cache: 'no-store' }` 或 URL 加時間戳（屬體驗優化，非接通必要）。

---

## 10. 不做（YAGNI）

- 不放任何起始公告內容（本次只接通管道）。
- 不做分類／標籤／搜尋／分頁／附件（屬「增強功能」方向，另案）。
- 不改公告頁版面與卡片樣式。
- 不預先做 CORS fallback——先測 published CSV，不行再換 gviz。
