# 公告附件 ＋ 文件下載整合 — 設計文件（Design Spec）

- **日期**：2026-06-25
- **狀態**：設計定稿，待進入實作
- **關聯**：延伸 `2026-06-25-announcements-go-live-design.md`（公告已接 Google 試算表）。本功能讓公告可夾帶一個附件、點擊開啟，並讓該附件與常設文件一起出現在「文件下載」頁。

---

## 1. 背景與目標

公告現讀 Google 試算表 published CSV（4 欄：日期/標題/內容/置頂）。文件下載頁 `documents.astro` 目前讀**程式內建靜態清單** `src/data/documents.js`（要改 code 才能加文件）。

**目標**：
1. 每則公告可夾帶**一個**檔案（Google Drive 連結）；公告頁顯示「📎 附件」，點擊開新分頁閱讀。
2. 該附件**自動**出現在文件下載頁（填一次、兩邊都出現）。
3. 文件下載頁同時容納**不綁公告的常設文件**（樂譜、報名表等）。
4. 維持低維護原則：兩者皆走 Google 試算表，幹部零程式即可維護。

**核心張力與解法**：公告（動態 CSV）vs 文件下載（靜態 JS）。解法＝把文件下載也升級成讀 Google 試算表，並讓它**合併**「公告附件」與「常設文件試算表」兩個來源。

---

## 2. 核心設計決策

| 項目 | 結論 | 說明 |
|---|---|---|
| 維護模型 | **單一來源、填一次兩邊出現** | 附件貼在公告那列 → 公告頁顯示、文件下載也讀公告表自動收錄 |
| 附件數 | **一則公告一個附件** | YAGNI；多附件日後再擴充欄位 |
| 附件承載 | **Google Drive 連結** | 與現有文件下載一致；不做檔案上傳 |
| 文件下載來源 | **公告附件 ＋ 常設文件試算表（合併）** | 文件下載頁由靜態改**動態**（client fetch 兩張 CSV） |
| 排序 | **置頂最前、其餘依日期新到舊** | 複用公告的 `pinnedFirst`；公告附件與常設文件一視同仁 |
| 置頂來源 | **公告置頂欄 ＋ 文件表置頂欄** | 公告附件繼承該公告 pinned；常設文件可自行置頂 |
| 安全 | **`esc()` 跳脫 ＋ `isSafeHref` 驗證連結** | 連結來自外部 CSV（不可信），須擋 `javascript:` 等 URL |

---

## 3. 資料模型（兩張試算表）

**公告試算表**（現有 4 欄 → 加 2 個選填欄，順序固定、依位置讀）：

| 日期 | 標題 | 內容 | 置頂 | 附件名稱 | 附件連結 |
|---|---|---|---|---|---|
| cols[0] | cols[1] | cols[2] | cols[3] | cols[4] | cols[5] |

- `附件連結` 有值 = 該則有附件；`附件名稱` 空白時退回用公告標題。
- **向後相容**：現行公告表只有 4 欄，`cols[4]/cols[5]` = undefined → `attachment = null`，不破壞既有。

**文件試算表**（新建，常設文件）：

| 日期 | 名稱 | 連結 | 類型 | 備註 | 置頂 |
|---|---|---|---|---|---|
| cols[0] | cols[1] | cols[2] | cols[3] | cols[4] | cols[5] |

- 日期欄同樣需設「純文字」格式（避免 Google 自動轉型）。
- 類型由幹部填（PDF／圖片／表單…）；公告附件的類型則由副檔名自動推。

---

## 4. 純函式契約（給 TDD）

### `src/lib/csv.js`（共用，新增）
```js
isSafeHref(url) -> boolean   // 僅 http:// 或 https:// 開頭（trim 後小寫比對）視為安全
```

### `src/lib/announcements.js`（改 `parseAnnouncementsCsv`）
```js
// 每列新增 attachment 欄位
parseAnnouncementsCsv(csv) -> [{ date, title, body, pinned, attachment }]
//   attachment = (cols[5] 有值 && isSafeHref(cols[5]))
//                ? { name: (cols[4]||title), url: cols[5] }
//                : null
```
既有 `isPinnedMark` / `pinnedFirst` / `fetchAnnouncements` 不變。

### `src/lib/documents.js`（新）
```js
parseDocumentsCsv(csv) -> [{ date, name, url, type, note, pinned }]
//   依位置讀文件表 6 欄；pinned 用 isPinnedMark；url 未通過 isSafeHref 的列其 url 設 ''（不可點）

inferType(name) -> 'PDF'|'圖片'|'Word'|'Excel'|'檔案'   // 由副檔名推；未知→'檔案'

announcementToDoc(a) -> { date, name, url, type, note, pinned, source:'announcement' } | null
//   a.attachment 為 null → 回 null
//   否則 name=a.attachment.name, url=a.attachment.url, type=inferType(name),
//        note=`來自「${a.title}」公告`, pinned=a.pinned, date=a.date

buildDocumentList(announcements, documents) -> 統一項目陣列（已排序）
//   = sortDocuments( documents.map(d=>{...source:'document'}) 串接 announcements.map(announcementToDoc).filter(Boolean) )

sortDocuments(items) -> pinnedFirst( byDateDesc(items) )
//   先依 date 字串降冪（YYYY-MM-DD 字串序＝時間序，穩定排序），再 pinnedFirst 穩定把置頂提前
//   相同日期維持輸入順序（buildDocumentList 串接：常設文件項在前、公告附件項在後）
```
統一項目結構：`{ date, name, url, type, note, pinned, source }`（`source` 用於是否標「來自公告」）。`pinnedFirst` 從 `announcements.js` import（單向依賴 documents → announcements，無循環）。

**測試重點**：
- `isSafeHref`：http/https 安全；`javascript:`、`data:`、空字串、相對路徑不安全。
- `parseAnnouncementsCsv`：有附件、無附件（向後相容 4 欄）、不安全 url→attachment null、附件名稱缺省退回標題。
- `parseDocumentsCsv`：解析 6 欄、置頂、跳過空行、不安全 url→url ''。
- `inferType`：.pdf/.jpg/.png/.docx/.xlsx/未知。
- `buildDocumentList`：合併兩來源、置頂最前、其餘日期新到舊、空輸入、只有其一來源。

---

## 5. 公告頁行為（`announcements.astro`）

client script 的 map 內，每則若 `a.attachment` 非空，於內容下方輸出可點附件：
```
📎 <附件名稱>   →  <a href esc(url) target=_blank rel="noopener noreferrer">
```
- `url` 已過 `isSafeHref`；輸出時仍 `esc()` 跳脫（防屬性跳脱）。
- 無附件的公告維持原樣。

---

## 6. 文件下載頁行為（`documents.astro`，靜態 → 動態）

改為 client 端 fetch 兩張 CSV 後 `buildDocumentList` 合併渲染（沿用公告頁的 `esc()` 防 XSS 寫法）：

```
annUrl = PUBLIC_ANNOUNCEMENTS_CSV || '/sample-announcements.csv'
docUrl = PUBLIC_DOCUMENTS_CSV     || '/sample-documents.csv'
[ann, doc] = await Promise.all([fetch(annUrl), fetch(docUrl)]) → 文字
items = buildDocumentList(parseAnnouncementsCsv(ann), parseDocumentsCsv(doc))
渲染卡片（保留現有 .doc 樣式：類型標籤＋名稱＋備註）
```

- **卡片**：日期（小字）＋類型標籤（綠）＋名稱（粗體）＋備註（公告附件顯示「來自○○公告」）；置頂者加「📌」；`url` 為空（不安全）時不可點、標示「連結無效」。
- **排序**：置頂最前、其餘日期新到舊（§4 `sortDocuments`）。
- **狀態**：載入中／空（「目前沒有文件。」）／失敗（「文件載入失敗，請稍後再試。」）。

---

## 7. 檔案架構

| 檔案 | 動作 |
|---|---|
| `src/lib/csv.js` | 新增 `isSafeHref` |
| `src/lib/announcements.js` | `parseAnnouncementsCsv` 解析 attachment（用 `isSafeHref`） |
| `src/lib/announcements.test.js` | 補附件案例 |
| `src/lib/documents.js` | **新**：`parseDocumentsCsv`／`inferType`／`announcementToDoc`／`buildDocumentList`／`sortDocuments` |
| `src/lib/documents.test.js` | **新** |
| `src/pages/announcements.astro` | 顯示 📎 附件 |
| `src/pages/documents.astro` | 改 client fetch 兩 CSV ＋ `esc()` 渲染 |
| `public/sample-documents.csv` | **新**：開發範例（含表頭、含一筆置頂） |
| `src/data/documents.js` | **退役**：`documents.astro` 不再 import；移除該檔 |
| 環境變數 `PUBLIC_DOCUMENTS_CSV` | **新**：文件試算表來源；未設 fallback `/sample-documents.csv` |

> **隔離原則**：`documents.js` 純邏輯不碰 DOM／網路；fetch 與組 HTML 留在 `documents.astro` client script。

---

## 8. 資料流

```
文件下載頁（瀏覽器載入時）：
  fetch(annUrl), fetch(docUrl)  並行
  parseAnnouncementsCsv(annText) → 公告（含 attachment）
  parseDocumentsCsv(docText)     → 常設文件
  buildDocumentList(公告, 文件)
    = [文件項…] + [公告中有附件者轉成的文件項…]  → 置頂最前、其餘日期新到舊
  esc() 跳脫後組 innerHTML 注入
```

---

## 9. 安全

- 所有插入值一律 `esc()` 跳脫（與公告頁相同）。
- **連結來自外部 CSV（不可信）** → `isSafeHref` 僅放行 `http(s):`，擋 `javascript:`／`data:` 等 URL 注入；不安全連結不輸出為可點 `href`。此檢查同時用於公告附件與文件表連結。

---

## 10. 上線設定（一次性，操作同公告）

1. 建「文件試算表」，第一列填 6 欄表頭，日期欄設純文字。
2. 既有「公告試算表」加 `附件名稱`、`附件連結` 兩欄表頭。
3. 文件試算表「發布到網路 → CSV」，取得連結。
4. Cloudflare 設 build 變數 `PUBLIC_DOCUMENTS_CSV` = 該連結；重新部署。
5. （公告表已發布過，加欄後內容自動帶出，無須重設變數。）

---

## 11. 驗收標準

- `npm test` 綠：`announcements.test.js`（附件案例）＋ `documents.test.js`（新）。
- `npm run build` 無誤。
- 公告頁：有附件公告顯示 📎、點擊開新分頁；無附件不顯示；4 欄舊表仍正常。
- 文件下載頁：合併公告附件＋文件表；置頂最前、其餘日期新到舊；載入／空／失敗狀態正常。
- 未設 `PUBLIC_DOCUMENTS_CSV` 時 fallback sample、不破版。
- 安全：CSV 內放 `javascript:` 連結時，不被渲染成可點連結。

---

## 12. 不做（YAGNI）

- 一則公告就一個附件（不做多附件）。
- 不做檔案上傳（走 Drive 連結）。
- 不做文件分類、搜尋、分頁。
- 公告附件不要求幹部填類型（由副檔名自動推）。
- 不做附件預覽內嵌（一律導去 Drive 開啟）。
