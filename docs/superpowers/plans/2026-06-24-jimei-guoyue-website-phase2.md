# 集美國小國樂社網站 Phase 2 實作計畫

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. 沿用 Phase 1 的做法：邏輯用 vitest（TDD），頁面用 `npm run build` ＋ 瀏覽器驗證；逐功能 commit（KyymmddX）。

**Goal:** 加入 Phase 2 三項功能：⭐活動支援報名（Google 表單＋公開看板）、活動相簿、成果與榮譽。

**Architecture:** 延續 Astro 靜態站。抽出共用 CSV 工具 `csv.js`；活動支援看板在瀏覽器端讀「表單回覆試算表發布的 CSV」即時彙整（沿用「會動的資料走 Google、零重新部署」原則）；相簿與成果為資料檔驅動的靜態頁。活動設定放程式資料檔（由技術家長維護）。

**Tech Stack:** 同 Phase 1 ＋ 看板彙整邏輯 vitest 單元測試。

---

## 開工前準備（Prep，新增）

- **每個支援活動**：建一份 Google 表單，問題建議含：
  - 「顯示稱呼」（短答，例：小明媽媽）— 看板會顯示這個，**不要問電話**
  - 「可幫忙項目」（核取方塊，選項＝各支援項目，如 搬運樂器/現場場佈/攝影記錄/餐點茶水）
  - 可選「能否到場」（單選：可／部分／不可）
  - 表單「回覆」分頁 → 連結到試算表 → 發布到網路 → CSV，取得 CSV 連結
- **相簿**：Google 相簿建立共享相簿，取得共享連結
- **成果**：整理歷年得獎／演出清單

---

## File Structure

```
src/lib/csv.js            # 新增：splitCsvLine（自 announcements 抽出）＋ parseCsvRows
src/lib/csv.test.js       # 新增
src/lib/announcements.js  # 修改：改從 csv.js 匯入並 re-export splitCsvLine（其餘不變）
src/lib/support.js        # 新增：summarizeSupport（看板彙整）
src/lib/support.test.js   # 新增
src/data/support-events.js  # 新增：活動支援設定
src/data/albums.js          # 新增：相簿清單
src/data/achievements.js    # 新增：成果清單
src/pages/support.astro      # 新增：活動支援頁（看板 client 端渲染）
src/pages/gallery.astro      # 新增：活動相簿頁
src/pages/achievements.astro # 新增：成果與榮譽頁
src/components/Header.astro   # 修改：導覽新增三項
src/styles/global.css         # 修改：看板樣式
```

---

## Task 1：抽出共用 CSV 工具 `csv.js`（TDD）

把 `splitCsvLine` 自 `announcements.js` 移到 `src/lib/csv.js`，並新增通用 `parseCsvRows`（依標題列轉成物件陣列）。`announcements.js` 改為從 `csv.js` 匯入並 re-export `splitCsvLine`，使既有測試與功能不變。

`src/lib/csv.js`：
```js
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

// 依標題列把 CSV 轉成物件陣列（key = 標題），略過空白行。
export function parseCsvRows(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    return row;
  });
}
```

`src/lib/announcements.js` 改動：移除本地 `splitCsvLine` 定義，改成：
```js
import { splitCsvLine } from './csv.js';
export { splitCsvLine };
```
（其餘 `isPinnedMark` / `parseAnnouncementsCsv` / `pinnedFirst` / `fetchAnnouncements` 不變。）

`src/lib/csv.test.js`：測 `parseCsvRows`（標題對應、空白行略過、缺欄補空字串）。

- [ ] 先寫 `csv.test.js`（紅）→ 建 `csv.js`、改 `announcements.js`（綠，含原有 12 測試）→ build → commit。

## Task 2：看板彙整邏輯 `support.js`（TDD）

`src/lib/support.js`：
```js
import { parseCsvRows } from './csv.js';

function splitItems(cell) {
  return String(cell ?? '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
}

// 回傳 { total, names, byCategory:[{label,target,signed,short,enough}] }
export function summarizeSupport(csvText, needs = [], opts = {}) {
  const { nameHeader = '顯示稱呼', itemsHeader = '可幫忙項目', attendHeader = '能否到場' } = opts;
  const rows = parseCsvRows(csvText);
  const helpers = rows.filter((r) => (r[attendHeader] ?? '') !== '不可');
  const names = helpers.map((r) => (r[nameHeader] ?? '').trim()).filter(Boolean);
  const byCategory = needs.map(({ label, target }) => {
    const signed = helpers.filter((r) => splitItems(r[itemsHeader]).includes(label)).length;
    return { label, target, signed, short: Math.max(0, target - signed), enough: signed >= target };
  });
  return { total: helpers.length, names, byCategory };
}
```

`src/lib/support.test.js`：用一段含標題列的回覆 CSV，驗證 total、names、各 category 的 signed/short/enough（含「不可」者不計、項目以逗號分隔多選）。

- [ ] 先寫測試（紅）→ 實作（綠）→ commit。

## Task 3：活動支援頁 `support.astro` ＋ 設定資料檔

`src/data/support-events.js`（範例，含佔位）：
```js
export const supportEvents = [
  {
    id: 'showcase-0712',
    name: '暑期成果發表會',
    date: '2026-07-12',
    formUrl: 'https://docs.google.com/forms/REPLACE',      // 報名表單連結
    responsesCsvUrl: '',                                    // 回覆試算表發布的 CSV（空＝看板顯示尚未設定）
    needs: [
      { label: '搬運樂器', target: 4 },
      { label: '現場場佈', target: 5 },
      { label: '攝影記錄', target: 2 },
      { label: '餐點茶水', target: 2 },
    ],
  },
];
```

`src/pages/support.astro`：列出每個活動（名稱/日期、「我要報名支援」按鈕→表單、看板容器）；設定以 `<script type="application/json">` 嵌入，另一個 module script 讀取後，逐活動 fetch 回覆 CSV → `summarizeSupport` → 渲染看板。看板列：`目前可支援 N 位`、各項目 `已報 X / 需 Y（還缺 Z）` 或 `足夠 ✓`、`感謝支援：稱謂…`。`responsesCsvUrl` 為空時顯示「看板尚未設定」。所有插入 CSV 來源字串以 `esc()` 跳脫。

- [ ] 建資料檔與頁面 → build → 用 preview eval 驗證看板（以範例 CSV）→ commit。

## Task 4：活動相簿 `gallery.astro`

`src/data/albums.js`：`[{ title, date, url, cover }]`（cover 可空，空時顯示 🎶 佔位）。
`src/pages/gallery.astro`：卡片格線，點擊 `target="_blank" rel="noopener noreferrer"` 開啟 Google 相簿。

- [ ] 建資料檔與頁面 → build → commit。

## Task 5：成果與榮譽 `achievements.astro`

`src/data/achievements.js`：`[{ year, title, detail }]`。
`src/pages/achievements.astro`：依年份條列（時間軸樣式）。

- [ ] 建資料檔與頁面 → build → commit。

## Task 6：導覽更新 ＋ 樣式 ＋ 整體驗證

- `Header.astro` nav 新增：`活動支援 /support`、`活動相簿 /gallery`、`成果 /achievements`（共 8 項，flex-wrap 換行）。
- `global.css` 新增看板樣式：`.support-event`、`.board-row`（flex space-between、底線）、`.board-row .ok`（綠）、`.board-row .need`（橘）。
- `npm run build`（預期 8 頁）＋ `npm test` 全綠 ＋ preview 目視。

- [ ] 改 nav、加樣式 → build/test → commit。

## Task 7：最終 code review ＋ 待部署

- 派獨立 code review 子代理檢視 Phase 2 diff（重點：看板 XSS 跳脫、summarizeSupport 邊界、檔案職責）。
- 修正後，Phase 1＋2 一起待部署（依 Phase 1 計畫 Task 10）。

---

## 上線前素材（補充 Phase 1 檢查表）

- [ ] 每個支援活動：Google 表單（含「顯示稱呼」「可幫忙項目」）＋ 回覆 CSV 連結 → 填入 `support-events.js`
- [ ] `albums.js` 換成真實 Google 相簿連結與封面
- [ ] `achievements.js` 換成真實歷年成果
