# 首頁「近期行程」清單 — 設計文件（Design Spec）

- **日期**：2026-06-25
- **狀態**：設計定稿，待進入實作
- **關聯**：補完 `2026-06-23-jimei-guoyue-club-website-design.md` 中「首頁 ＝ 最新公告摘要 ＋ 近期行程 ＋ 快速入口」的「近期行程」一塊（當時未實作）。

---

## 1. 背景與目標

首頁 hero 目前只有一顆「看近期行事曆」按鈕，連到行事曆頁（Google 日曆 iframe）。家長要多點一次才看得到時間。

**目標**：首頁直接顯示「未來最近的活動清單」，一進站就看到接下來幾場練習／演出／活動，不用再點進去。

**關鍵限制**：行事曆頁是 Google **iframe 嵌入**，拿不到活動「資料」。要做清單，必須改從能讀到資料的來源取得 → 採 **Google Calendar API**（前端 fetch、永遠即時）。

---

## 2. 核心設計決策

| 項目 | 結論 | 說明 |
|---|---|---|
| 資料來源 | **Google Calendar API（前端 fetch）** | 三個公開日曆各取未來活動，合併排序；永遠即時，幹部端維護不變 |
| 顯示筆數 | **未來最近 5 筆** | 永遠有內容、不爆量；優於「本月／未來 30 天」（淡季空白、旺季過長） |
| 版面 | **日期靠左單行列** | 左：`M/D`＋星期；中：顏色點＋標題；右：時間（或「全天」） |
| 顏色 | **沿用三日曆色** | 國樂團 `#e4c441`、古箏/提琴 `#f09300`、暑訓 `#c0ca33`；上方小圖例 |
| 位置 | **精簡 hero 下方獨立卡** | 拿掉原按鈕；卡片底部「看完整行事曆 →」連到 `/calendar` |
| 金鑰 | **`PUBLIC_GOOGLE_API_KEY` 環境變數** | 限定本站 referrer ＋ 唯讀；未設時降級（見 §7） |

---

## 3. 架構與檔案

| 檔案 | 類型 | 職責 |
|---|---|---|
| `src/data/calendars.js` | 新增 | 三日曆設定單一來源 `[{ name, id, color }]`；`calendar.astro` 與首頁共用 |
| `src/pages/calendar.astro` | 改 | 改 import `calendars.js`，移除行內寫死的清單（行為不變） |
| `src/lib/events.js` | 新增 | 純邏輯：正規化／合併／排序／取 N／格式化日期時間 |
| `src/lib/events.test.js` | 新增 | vitest 單元測試（對齊 `src/lib/` 慣例） |
| `src/data/sample-events.js` | 新增 | 開發／無金鑰時的範例資料（相對今天產生，恆為未來） |
| `src/pages/index.astro` | 改 | hero 精簡；新增「近期行程」section ＋ client script |

> **隔離原則**：`events.js` 不碰 DOM、不呼叫網路、不讀 `new Date()`——`now` 與「事件陣列」由呼叫端注入，純函式才能測。fetch 與 `esc()` 組 HTML 留在 `index.astro` 的 client script（沿用公告頁同套防 XSS 寫法）。

---

## 4. 資料流

```
client 端（瀏覽器，頁面載入時）
  for cal of calendars:
    GET https://www.googleapis.com/calendar/v3/calendars/{encodeURIComponent(cal.id)}/events
        ?key={KEY}&timeMin={now ISO}&singleEvents=true&orderBy=startTime&maxResults=10
    → items[]，附上 cal.name / cal.color
  合併三批 → toUpcoming(events, now) → takeNext(5) → esc() 組 HTML 注入
```

Google 回傳每筆 `item.start` 為二擇一：
- 計時活動：`start.dateTime`（RFC3339，含 `+08:00`）
- 全天活動：`start.date`（`YYYY-MM-DD`，無時間）

---

## 5. 純函式契約（給 TDD）

```js
// 解析單筆 → 正規化
parseStart(item) -> { at: Date, isAllDay: boolean }
normalize(item, calMeta) -> { title, at, isAllDay, color, calName }

// 集合處理（now 由外部注入）
toUpcoming(events, now) -> 過濾 at >= 當日起點、依 at 升冪排序
takeNext(events, n)     -> 取前 n 筆

// 顯示格式（時區 Asia/Taipei）
formatMonthDay(at)  -> "7/2"
formatWeekday(at)   -> "週三"
formatTime(ev)      -> 計時 "09:00"；全天 "全天"
```

**測試重點**：全天 vs 計時、跨月排序、未來過濾（今天稍早的計時活動不顯示、今天的全天活動要顯示）、Asia/Taipei 時區格式化、空輸入。

---

## 6. 顯示規格

- **行格式**：`[M/D ＋ 星期]　●色點　標題　……　時間`
- **全天**：時間欄顯示「全天」
- **圖例**：清單上方一行小圖例（● 國樂團／● 古箏提琴／● 暑訓）
- **底部連結**：「看完整行事曆 →」→ `/calendar`
- **空狀態**：無未來活動時顯示「近期暫無安排，請見完整行事曆」

---

## 7. 降級與錯誤處理

| 情況 | 行為 |
|---|---|
| 金鑰未設 | 用 `sample-events.js` 範例資料渲染（恆為未來），並加小字「（範例資料）」；不破版。與公告頁「未設環境變數 fallback 範例」一致 |
| fetch 失敗 | 顯示「行程載入失敗」一行，不影響其餘頁面 |
| 取得成功但無未來活動 | 顯示空狀態文案（見 §6） |

---

## 8. 安全

- client 端組 HTML 一律先 `esc()` 跳脫（防 XSS），與公告頁相同。
- 金鑰雖為 `PUBLIC_`（會出現在前端），以 **HTTP referrer 限定本站網域 ＋ 僅開放 Calendar API ＋ 讀取公開資料** 控管，屬標準安全做法。

---

## 9. 待使用者完成（一次性）

1. Google Cloud 建立或選一個專案 → 啟用 **Google Calendar API**。
2. 建立 **API 金鑰**；限制：Application restriction = HTTP referrers（填本站網域，含 `*.workers.dev` 與本機 dev）；API restriction = Calendar API。
3. Cloudflare 環境變數設 `PUBLIC_GOOGLE_API_KEY`（本機 dev 放 `.env`）。
4. 確認三日曆皆「公開供大眾使用＋查看完整內容」（已完成）。

---

## 10. 驗收標準

- `npm test` 綠（`events.test.js`）。
- `npm run build` 無誤。
- 預覽：桌機／手機版面正確、圖例與顏色對、連結指向 `/calendar`。
- 金鑰未設時用範例資料、不破版；設金鑰後顯示真實未來活動。

---

## 11. 不做（YAGNI）

- 不做「載入更多／分頁」、活動詳情彈窗、地點/說明顯示（只標題＋時間）。
- 不做 build-time 預抓快取（即時性優先；client fetch 已足夠）。
- 不動公告區與快速前往區。
