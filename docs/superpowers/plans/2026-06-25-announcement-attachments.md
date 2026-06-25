# 公告附件 ＋ 文件下載整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓每則公告可夾帶一個 Google Drive 附件、點擊開啟，並自動與常設文件一起出現在改為動態的「文件下載」頁。

**Architecture:** 解析／合併／排序／連結安全檢查全抽成 `src/lib` 純函式，用 vitest TDD。公告頁與文件下載頁在 client script `fetch` CSV、用 `esc()` 防 XSS 組 `innerHTML`（沿用 `announcements.astro` / `support.astro` 既有模式）。文件下載頁由「build 時 import 靜態陣列」改為「client fetch 兩張 CSV（公告 ＋ 文件）合併」。

**Tech Stack:** Astro、原生 JS、vitest。

**對應 spec:** `docs/superpowers/specs/2026-06-25-announcement-attachments-design.md`

**專案慣例（重要）：**
- commit message 用 `KyymmddX [JimeiGuoyue] 標題.` 格式；**每次 commit 前需使用者確認**，不可自動 commit。
- 程式碼**不**嵌行內 `KyymmddX` tag（本專案網頁碼保持乾淨）。
- 下方每個 task 都附一個 commit step（TDD 頻繁提交）。執行時**可依專案「功能級 commit」慣例合併**為三個 commit：①純邏輯（Task 1–6）、②公告頁（Task 7）、③文件頁＋退役靜態檔（Task 8）。序號（`K2606xxX`）執行當天依 `git log` 接續。

---

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `src/lib/csv.js` | CSV 與共用前端小工具 | 加 `isSafeHref` |
| `src/lib/csv.test.js` | 上者測試 | 加 `isSafeHref` 案例 |
| `src/lib/announcements.js` | 公告解析／置頂 | `parseAnnouncementsCsv` 解析 `attachment` |
| `src/lib/announcements.test.js` | 上者測試 | 加 attachment 案例 |
| `src/lib/documents.js` | **新**：文件清單純邏輯 | `parseDocumentsCsv`／`inferType`／`announcementToDoc`／`sortDocuments`／`buildDocumentList` |
| `src/lib/documents.test.js` | **新** | 全函式測試 |
| `src/pages/announcements.astro` | 公告頁 | 顯示 📎 附件 |
| `src/pages/documents.astro` | 文件下載頁 | 改 client fetch 兩 CSV ＋ `esc()` 渲染 |
| `public/sample-documents.csv` | **新** | 開發範例（含表頭、一筆置頂） |
| `src/data/documents.js` | 舊靜態清單 | **退役移除** |
| `.env.example` | 環境變數範本 | 加 `PUBLIC_DOCUMENTS_CSV` |

**依賴方向（無循環）：** `documents.js` → `announcements.js` → `csv.js`；`documents.js` → `csv.js`。

---

## Task 1: `isSafeHref`（連結安全檢查）

**Files:**
- Modify: `src/lib/csv.js`
- Test: `src/lib/csv.test.js`

- [ ] **Step 1: 在 `csv.test.js` 加失敗測試**

把第 2 行 import 改為：
```js
import { splitCsvLine, parseCsvRows, isSafeHref } from './csv.js';
```
在檔案末尾加：
```js
describe('isSafeHref', () => {
  it('accepts http(s) URLs (trims first)', () => {
    expect(isSafeHref('https://drive.google.com/file/d/x')).toBe(true);
    expect(isSafeHref('  http://example.com  ')).toBe(true);
  });
  it('rejects javascript:, data:, blank, relative, nullish', () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,x', '', '   ', '/local', 'drive.google.com', undefined, null]) {
      expect(isSafeHref(u)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/csv.test.js`
Expected: FAIL（`isSafeHref is not a function`）

- [ ] **Step 3: 在 `csv.js` 實作**

在檔案末尾加：
```js
// 連結安全檢查：僅 http(s) 視為可點，擋 javascript:/data: 等 URL 注入。
export function isSafeHref(url) {
  return /^https?:\/\//i.test(String(url ?? '').trim());
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/csv.test.js`
Expected: PASS

- [ ] **Step 5: commit（先經使用者確認）**

```bash
git add src/lib/csv.js src/lib/csv.test.js
git commit -m "K2606xxX [JimeiGuoyue] Add isSafeHref link-safety helper."
```

---

## Task 2: `parseAnnouncementsCsv` 解析附件

**Files:**
- Modify: `src/lib/announcements.js`
- Test: `src/lib/announcements.test.js`

- [ ] **Step 1: 加失敗測試**

在 `announcements.test.js` 末尾加：
```js
describe('parseAnnouncementsCsv attachments', () => {
  it('reads 附件名稱/附件連結 into attachment', () => {
    const csv = '日期,標題,內容,置頂,附件名稱,附件連結\n2026-06-20,A,B,,通知單,https://drive.google.com/x\n';
    expect(parseAnnouncementsCsv(csv)[0].attachment).toEqual({ name: '通知單', url: 'https://drive.google.com/x' });
  });
  it('falls back to the title when 附件名稱 is blank', () => {
    const csv = '日期,標題,內容,置頂,附件名稱,附件連結\n2026-06-20,成果發表,B,,,https://drive.google.com/x\n';
    expect(parseAnnouncementsCsv(csv)[0].attachment).toEqual({ name: '成果發表', url: 'https://drive.google.com/x' });
  });
  it('is null with no link (backward compatible with 4-column sheets)', () => {
    const csv = '日期,標題,內容,置頂\n2026-06-20,A,B,\n';
    expect(parseAnnouncementsCsv(csv)[0].attachment).toBe(null);
  });
  it('is null when the link is unsafe', () => {
    const csv = '日期,標題,內容,置頂,附件名稱,附件連結\n2026-06-20,A,B,,x,javascript:alert(1)\n';
    expect(parseAnnouncementsCsv(csv)[0].attachment).toBe(null);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/announcements.test.js`
Expected: FAIL（`attachment` undefined）

- [ ] **Step 3: 實作**

`announcements.js` 第 2 行 import 改為：
```js
import { splitCsvLine, isSafeHref } from './csv.js';
```
`parseAnnouncementsCsv` 迴圈內，把 `items.push(...)` 那行改為：
```js
    const attName = (cols[4] ?? '').trim();
    const attUrl = (cols[5] ?? '').trim();
    const attachment = attUrl && isSafeHref(attUrl) ? { name: attName || title, url: attUrl } : null;
    items.push({ date, title, body, pinned: isPinnedMark(cols[3]), attachment });
```

- [ ] **Step 4: 跑測試確認通過（含既有公告測試不回歸）**

Run: `npx vitest run src/lib/announcements.test.js`
Expected: PASS（全部）

- [ ] **Step 5: commit（先經使用者確認）**

```bash
git add src/lib/announcements.js src/lib/announcements.test.js
git commit -m "K2606xxX [JimeiGuoyue] Parse an optional attachment column in announcements."
```

---

## Task 3: `inferType`（副檔名推類型）

**Files:**
- Create: `src/lib/documents.js`
- Test: `src/lib/documents.test.js`

- [ ] **Step 1: 建 `documents.test.js` 寫失敗測試**

```js
import { describe, it, expect } from 'vitest';
import { inferType } from './documents.js';

describe('inferType', () => {
  it('maps by extension (case-insensitive)', () => {
    expect(inferType('通知單.pdf')).toBe('PDF');
    expect(inferType('photo.JPG')).toBe('圖片');
    expect(inferType('表單.docx')).toBe('Word');
    expect(inferType('名單.xlsx')).toBe('Excel');
  });
  it('returns 檔案 for unknown or missing extension', () => {
    expect(inferType('成果發表會通知單')).toBe('檔案');
    expect(inferType('')).toBe('檔案');
    expect(inferType(undefined)).toBe('檔案');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/documents.test.js`
Expected: FAIL（找不到 `./documents.js` 或 `inferType`）

- [ ] **Step 3: 建 `documents.js` 實作**

```js
import { splitCsvLine, isSafeHref } from './csv.js';
import { isPinnedMark, pinnedFirst } from './announcements.js';

const TYPE_BY_EXT = {
  pdf: 'PDF',
  jpg: '圖片', jpeg: '圖片', png: '圖片', gif: '圖片', webp: '圖片',
  doc: 'Word', docx: 'Word',
  xls: 'Excel', xlsx: 'Excel',
};

export function inferType(name) {
  const m = String(name ?? '').toLowerCase().match(/\.([a-z0-9]+)\s*$/);
  return (m && TYPE_BY_EXT[m[1]]) || '檔案';
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/documents.test.js`
Expected: PASS

- [ ] **Step 5: commit（先經使用者確認；或併入 Task 6 一起提交）**

```bash
git add src/lib/documents.js src/lib/documents.test.js
git commit -m "K2606xxX [JimeiGuoyue] Add inferType for document type labels."
```

---

## Task 4: `parseDocumentsCsv`

**Files:**
- Modify: `src/lib/documents.js`
- Test: `src/lib/documents.test.js`

- [ ] **Step 1: 加失敗測試**

在 `documents.test.js` 的 import 補上 `parseDocumentsCsv`：
```js
import { inferType, parseDocumentsCsv } from './documents.js';
```
加：
```js
describe('parseDocumentsCsv', () => {
  it('parses rows, skips header, reads pinned, tags source', () => {
    const csv = '日期,名稱,連結,類型,備註,置頂\n2026-06-01,報名表,https://drive.google.com/a,PDF,新生,V\n';
    expect(parseDocumentsCsv(csv)).toEqual([
      { date: '2026-06-01', name: '報名表', url: 'https://drive.google.com/a', type: 'PDF', note: '新生', pinned: true, source: 'document' },
    ]);
  });
  it('blanks an unsafe url but keeps the row', () => {
    const csv = '日期,名稱,連結,類型,備註,置頂\n2026-06-01,壞連結,javascript:alert(1),PDF,,\n';
    const d = parseDocumentsCsv(csv)[0];
    expect(d.url).toBe('');
    expect(d.name).toBe('壞連結');
  });
  it('ignores blank lines', () => {
    const csv = '日期,名稱,連結,類型,備註,置頂\n\n2026-06-01,A,https://x.com,PDF,,\n\n';
    expect(parseDocumentsCsv(csv)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/documents.test.js`
Expected: FAIL（`parseDocumentsCsv` undefined）

- [ ] **Step 3: 實作（加到 `documents.js`）**

```js
export function parseDocumentsCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  const items = [];
  for (let i = 1; i < lines.length; i++) { // 跳過標題列
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = splitCsvLine(line);
    const date = (cols[0] ?? '').trim();
    const name = (cols[1] ?? '').trim();
    const url = (cols[2] ?? '').trim();
    const type = (cols[3] ?? '').trim();
    const note = (cols[4] ?? '').trim();
    if (!date && !name && !url) continue;
    items.push({
      date, name,
      url: isSafeHref(url) ? url : '',
      type, note,
      pinned: isPinnedMark(cols[5]),
      source: 'document',
    });
  }
  return items;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/documents.test.js`
Expected: PASS

- [ ] **Step 5: commit（先經使用者確認；或併入 Task 6）**

```bash
git add src/lib/documents.js src/lib/documents.test.js
git commit -m "K2606xxX [JimeiGuoyue] Parse the documents CSV into items."
```

---

## Task 5: `announcementToDoc`（公告附件 → 文件項）

**Files:**
- Modify: `src/lib/documents.js`
- Test: `src/lib/documents.test.js`

- [ ] **Step 1: 加失敗測試**

import 補 `announcementToDoc`：
```js
import { inferType, parseDocumentsCsv, announcementToDoc } from './documents.js';
```
加：
```js
describe('announcementToDoc', () => {
  it('converts an announcement that has an attachment', () => {
    const a = { date: '2026-06-20', title: '成果發表', body: 'x', pinned: true, attachment: { name: '通知單.pdf', url: 'https://drive.google.com/x' } };
    expect(announcementToDoc(a)).toEqual({
      date: '2026-06-20', name: '通知單.pdf', url: 'https://drive.google.com/x',
      type: 'PDF', note: '來自「成果發表」公告', pinned: true, source: 'announcement',
    });
  });
  it('returns null without an attachment', () => {
    expect(announcementToDoc({ date: '2026-06-20', title: 'A', pinned: false, attachment: null })).toBe(null);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/documents.test.js`
Expected: FAIL（`announcementToDoc` undefined）

- [ ] **Step 3: 實作（加到 `documents.js`）**

```js
export function announcementToDoc(a) {
  if (!a || !a.attachment) return null;
  return {
    date: a.date,
    name: a.attachment.name,
    url: a.attachment.url,
    type: inferType(a.attachment.name),
    note: `來自「${a.title}」公告`,
    pinned: a.pinned,
    source: 'announcement',
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/documents.test.js`
Expected: PASS

- [ ] **Step 5: commit（先經使用者確認；或併入 Task 6）**

```bash
git add src/lib/documents.js src/lib/documents.test.js
git commit -m "K2606xxX [JimeiGuoyue] Convert announcement attachments into document items."
```

---

## Task 6: `sortDocuments` ＋ `buildDocumentList`

**Files:**
- Modify: `src/lib/documents.js`
- Test: `src/lib/documents.test.js`

- [ ] **Step 1: 加失敗測試**

import 補：
```js
import { inferType, parseDocumentsCsv, announcementToDoc, buildDocumentList } from './documents.js';
```
加：
```js
describe('buildDocumentList', () => {
  it('puts pinned first, then newest date', () => {
    const docs = [
      { date: '2026-06-01', name: 'old-doc', pinned: false, source: 'document' },
      { date: '2026-06-10', name: 'pin-doc', pinned: true, source: 'document' },
    ];
    const anns = [
      { date: '2026-06-05', title: 'A', pinned: false, attachment: { name: 'a', url: 'https://x.com' } },
      { date: '2026-06-20', title: 'B', pinned: true, attachment: { name: 'b', url: 'https://x.com' } },
    ];
    expect(buildDocumentList(anns, docs).map((d) => d.name)).toEqual(['b', 'pin-doc', 'a', 'old-doc']);
  });
  it('keeps document before announcement on the same date (stable)', () => {
    const docs = [{ date: '2026-06-05', name: 'doc', pinned: false, source: 'document' }];
    const anns = [{ date: '2026-06-05', title: 'T', pinned: false, attachment: { name: 'ann', url: 'https://x.com' } }];
    expect(buildDocumentList(anns, docs).map((d) => d.name)).toEqual(['doc', 'ann']);
  });
  it('handles empty inputs', () => {
    expect(buildDocumentList([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/documents.test.js`
Expected: FAIL（`buildDocumentList` undefined）

- [ ] **Step 3: 實作（加到 `documents.js`）**

```js
// 依日期降冪、相同日期維持輸入順序（穩定）。
function byDateDesc(items) {
  return items
    .map((it, i) => [it, i])
    .sort((a, b) => (a[0].date < b[0].date ? 1 : a[0].date > b[0].date ? -1 : a[1] - b[1]))
    .map(([it]) => it);
}

export function sortDocuments(items) {
  return pinnedFirst(byDateDesc(items));
}

export function buildDocumentList(announcements, documents) {
  const fromAnn = announcements.map(announcementToDoc).filter(Boolean);
  return sortDocuments([...documents, ...fromAnn]);
}
```

- [ ] **Step 4: 跑測試確認通過（整個 lib 不回歸）**

Run: `npm test`
Expected: PASS（csv／announcements／documents／support 全綠）

- [ ] **Step 5: commit（先經使用者確認）**

```bash
git add src/lib/documents.js src/lib/documents.test.js
git commit -m "K2606xxX [JimeiGuoyue] Merge and sort documents (pinned first, then newest)."
```

---

## Task 7: 公告頁顯示附件

**Files:**
- Modify: `src/pages/announcements.astro`

> 頁面 client script 無單元測試慣例（與既有頁面一致），以 `npm run build` ＋ 手動檢視驗證。

- [ ] **Step 1: 改 client script 的 map**

把 items.map 那行（第 18 行附近）整段替換為：
```js
        ? items.map((a) => `<article class="card">${a.pinned ? '<span class="pin">📌 置頂</span> ' : ''}<time>${esc(a.date)}</time><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p>${a.attachment ? `<p class="att"><a href="${esc(a.attachment.url)}" target="_blank" rel="noopener noreferrer">📎 ${esc(a.attachment.name)}</a></p>` : ''}</article>`).join('')
```

- [ ] **Step 2: build 驗證**

Run: `npm run build`
Expected: `Complete!`、8 page(s) built、無錯誤。

- [ ] **Step 3: 手動驗證（dev）**

把本地 `.env` 的 `PUBLIC_ANNOUNCEMENTS_CSV` 暫指向一個含附件兩欄、且有一列填了 `https://…` 附件的測試 CSV（或用線上試算表），`npm run dev` 開 `/announcements`：有附件的公告顯示「📎 名稱」可點、開新分頁；無附件的不顯示。驗畢還原 `.env`。

- [ ] **Step 4: commit（先經使用者確認）**

```bash
git add src/pages/announcements.astro
git commit -m "K2606xxX [JimeiGuoyue] Show an attachment link on announcements that have one."
```

---

## Task 8: 文件下載頁改動態 ＋ 範例 CSV ＋ 退役靜態檔

**Files:**
- Create: `public/sample-documents.csv`
- Modify: `src/pages/documents.astro`
- Modify: `.env.example`
- Delete: `src/data/documents.js`

- [ ] **Step 1: 建 `public/sample-documents.csv`**

```csv
日期,名稱,連結,類型,備註,置頂
2026-06-01,（範例）社團報名表,https://drive.google.com/REPLACE,PDF,新團員填寫,V
2026-05-20,（範例）樂器調借申請單,https://drive.google.com/REPLACE,PDF,,
2026-04-10,（範例）樂譜總表,https://drive.google.com/REPLACE,Excel,各分部,
```

- [ ] **Step 2: 改寫 `documents.astro`**

整檔替換為：
```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="文件下載">
  <h1>文件下載</h1>
  <p class="muted">通知單、樂譜、報名與繳費表單。點擊在 Google 雲端硬碟開啟／下載。</p>
  <div id="documents" class="grid cols-2"><p class="muted">載入中…</p></div>
</Layout>
<script>
  import { fetchAnnouncements } from '../lib/announcements.js';
  import { parseDocumentsCsv, buildDocumentList } from '../lib/documents.js';
  const el = document.getElementById('documents');
  if (el) {
    const annUrl = import.meta.env.PUBLIC_ANNOUNCEMENTS_CSV || '/sample-announcements.csv';
    const docUrl = import.meta.env.PUBLIC_DOCUMENTS_CSV || '/sample-documents.csv';
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    try {
      const [anns, docText] = await Promise.all([
        fetchAnnouncements(annUrl),
        fetch(docUrl).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); }),
      ]);
      const items = buildDocumentList(anns, parseDocumentsCsv(docText));
      el.innerHTML = items.length
        ? items.map((d) => {
            const pin = d.pinned ? '<span class="pin">📌</span> ' : '';
            const note = d.note ? `<p class="muted">${esc(d.note)}</p>` : '';
            const inner = `<span class="doc-type">${esc(d.type)}</span><span>${pin}<strong>${esc(d.name)}</strong>${note}<time class="doc-date">${esc(d.date)}</time></span>`;
            return d.url
              ? `<a class="card doc" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
              : `<div class="card doc">${inner}<span class="muted">（連結無效）</span></div>`;
          }).join('')
        : '<p class="muted">目前沒有文件。</p>';
    } catch (e) {
      el.innerHTML = '<p class="muted">文件載入失敗，請稍後再試。</p>';
    }
  }
</script>
<style>
  .doc{display:flex;gap:.8rem;align-items:center;text-decoration:none;color:inherit}
  .doc:hover{border-color:var(--gold)}
  .doc-type{background:var(--brand);color:#fff;font-size:.7rem;padding:.2rem .5rem;border-radius:6px;flex-shrink:0}
  .doc p{margin:.15rem 0 0}
  .doc-date{display:block;font-size:.75rem;color:var(--muted,#777);margin-top:.15rem}
</style>
```

- [ ] **Step 3: 刪除 `src/data/documents.js`**

Run: `git rm src/data/documents.js`

- [ ] **Step 4: 在 `.env.example` 末尾加變數說明**

```
# 文件下載：另一張「文件試算表」發布的 CSV 連結（常設文件用）
# 未設時 fallback /sample-documents.csv
PUBLIC_DOCUMENTS_CSV=/sample-documents.csv
```

- [ ] **Step 5: build 驗證**

Run: `npm run build`
Expected: `Complete!`、8 page(s) built、無錯誤（確認沒有殘留 import `src/data/documents.js`）。

- [ ] **Step 6: 手動驗證（dev）**

`npm run dev` 開 `/documents`：未設 `PUBLIC_DOCUMENTS_CSV` 時讀 `sample-documents.csv` ＋ 公告 sample 的附件（若有），合併顯示；置頂（📌 範例報名表）排最前、其餘依日期新到舊；卡片有類型標籤＋名稱＋備註＋日期。

- [ ] **Step 7: commit（先經使用者確認）**

```bash
git add public/sample-documents.csv src/pages/documents.astro .env.example
git commit -m "K2606xxX [JimeiGuoyue] Make documents page dynamic, merging announcement attachments."
```

---

## Task 9: 整合驗證

**Files:** 無（驗證）

- [ ] **Step 1: 全測試綠**

Run: `npm test`
Expected: PASS（csv／announcements／documents／support）

- [ ] **Step 2: build**

Run: `npm run build`
Expected: `Complete!`、8 page(s) built。

- [ ] **Step 3: 安全抽查**

在本地 `sample-documents.csv` 暫加一列 `2026-06-09,壞連結,javascript:alert(1),PDF,,`，`npm run dev` 開 `/documents`，確認該列顯示「（連結無效）」、不可點、無 JS 執行。驗畢移除該列。

- [ ] **Step 4: 更新專案筆記（另開 commit）**

更新 `CLAUDE.md`：目錄結構 `src/data` 移除 documents、新增 `src/lib/documents.js`；待辦標示「公告附件＋文件下載整合」已完成；部署段加 `PUBLIC_DOCUMENTS_CSV`。commit（`[Internal]`，先經使用者確認）。

---

## 上線（一次性，使用者操作，操作同公告 CSV）

1. 既有公告試算表加 `附件名稱`、`附件連結` 兩欄表頭。
2. 新建「文件試算表」（日期/名稱/連結/類型/備註/置頂），日期欄設純文字，發布到網路 → CSV。
3. Cloudflare 設 build 變數 `PUBLIC_DOCUMENTS_CSV` = 文件試算表 CSV 連結，重新部署。
4. 驗證 `/documents` 線上無 CORS 錯誤、合併顯示正確。
