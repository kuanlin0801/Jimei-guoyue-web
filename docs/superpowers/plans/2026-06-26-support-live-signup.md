# 活動支援改版（站內即時報名／認領）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓「活動支援」頁支援兩種型態（接龍湊人手／分工認領），家長在網頁上直接填稱呼送出（寫回 Google 試算表），看板即時更新；幹部用試算表自助設定活動。

**Architecture:** 統一「工作清單」資料模型（活動底下 N 個工作、每工作要 k 人、可內定）。讀取走 Google Apps Script `doGet`（即時、無 CSV 快取），失敗自動退回發布 CSV；寫入走 Apps Script `doPost`。彙整邏輯集中在純函式 `src/lib/support.js`（vitest 可測），即時 JSON 與 CSV 後備最終匯流到同一套組裝函式。

**Tech Stack:** Astro（靜態）＋原生 JS、vitest、Google 試算表＋Apps Script。

**設計來源：** [docs/superpowers/specs/2026-06-26-support-live-signup-design.md](../specs/2026-06-26-support-live-signup-design.md)

**Commit 規定：** 每個 commit 用專案 KyymmddX 格式（`KyymmddX [JimeiGuoyue] 英文標題.`）＋英文條列 body ＋空一行 `Release Note:` 區塊（a/b/c PM 視角）。序號以執行當日最新為準（範例用 `K260626J…`）。**依專案規定，每次 `git commit` 前需經使用者確認。**

---

## 檔案結構

| 檔案 | 角色 | 動作 |
|---|---|---|
| `src/lib/support.js` | 純邏輯：把三組資料列組成兩型看板 view model | 重寫 |
| `src/lib/support.test.js` | `buildSupportView` 的 vitest 測試 | 重寫 |
| `public/sample-support-activities.csv` | 開發用「活動」範例 | 新增 |
| `public/sample-support-jobs.csv` | 開發用「工作」範例 | 新增 |
| `public/sample-support-responses.csv` | 開發用「報名」範例 | 重寫 |
| `apps-script/support.gs` | Apps Script 參考碼（手動部署、不進 build） | 新增 |
| `src/pages/support.astro` | 兩型渲染＋讀取（doGet→CSV 後備）＋送出（doPost）＋輪詢 | 重寫 |
| `src/data/support-events.js` | 舊的程式碼活動定義 | 刪除 |
| `docs/superpowers/plans/2026-06-26-support-go-live-checklist.md` | 上線操作清單（試算表／部署／環境變數） | 新增 |
| `CLAUDE.md` | 專案狀態筆記 | 更新 |

---

## Task 1: 重寫純邏輯 `src/lib/support.js` 與測試

**Files:**
- Modify (重寫): `src/lib/support.js`
- Test (重寫): `src/lib/support.test.js`

**View model 規格（後續任務都依此命名，務必一致）：**

`buildSupportView({ activities, jobs, responses })` 回傳 `Activity[]`：

```
Activity = {
  name, date, time,
  type: '接龍' | '分工',
  status: '開放' | '額滿' | '結束',
  ended: boolean, full: boolean, open: boolean,   // 對應 status
  note: string, lineUrl: string,                  // lineUrl 為安全 http(s) 或 ''
  jobs: Job[],
  total: number,                                   // 跨工作不重複的稱呼人數
}
Job = {
  label: string,            // 接龍為 ''
  target: number | null,    // 需求人數；空白或 0 → null
  assigned: string[],       // 分工「指定」欄拆出的內定者
  claimers: string[],       // 報名分頁對到此活動(＋工作)的稱呼
  names: string[],          // assigned 在前、claimers 在後
  signed: number,           // names.length
  short: number,            // target 為數字時 max(0,target-signed)，否則 0
  enough: boolean,          // assignedFixed || (target!=null && signed>=target)
  assignedFixed: boolean,   // assigned.length > 0（已內定）
  canClaim: boolean,        // !assignedFixed && open && !enough
}
```

- [ ] **Step 1: 寫失敗測試（重寫整個測試檔）**

寫入 `src/lib/support.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { buildSupportView } from './support.js';

const find = (view, name) => view.find((a) => a.name === name);
const job = (act, label = '') => act.jobs.find((j) => j.label === label);

describe('buildSupportView — 接龍', () => {
  const data = {
    activities: [
      { 名稱: '早自習跑班', 日期: '2026-06-29', 時間: '8:00-8:40', 類型: '接龍', 狀態: '開放', 需求人數: '8', 說明: '需搬樂器', 'LINE連結': '' },
    ],
    jobs: [],
    responses: [
      { 時間戳記: '1', 活動: '早自習跑班', 工作: '', 稱呼: '侑亭媽' },
      { 時間戳記: '2', 活動: '早自習跑班', 工作: '', 稱呼: '彥辰媽' },
      { 時間戳記: '3', 活動: '早自習跑班', 工作: '', 稱呼: '芳語爸' },
    ],
  };
  it('一個隱含工作、名單依序、進度正確', () => {
    const act = find(buildSupportView(data), '早自習跑班');
    expect(act.type).toBe('接龍');
    expect(act.jobs).toHaveLength(1);
    const j = job(act);
    expect(j.names).toEqual(['侑亭媽', '彥辰媽', '芳語爸']);
    expect(j).toMatchObject({ target: 8, signed: 3, short: 5, enough: false, canClaim: true });
    expect(act.total).toBe(3);
  });
  it('達標後 enough 為真、canClaim 為假', () => {
    const full = { ...data, activities: [{ ...data.activities[0], 需求人數: '3' }] };
    const j = job(find(buildSupportView(full), '早自習跑班'));
    expect(j).toMatchObject({ signed: 3, short: 0, enough: true, canClaim: false });
  });
  it('需求人數空白 → target 為 null，仍可報名', () => {
    const open = { ...data, activities: [{ ...data.activities[0], 需求人數: '' }] };
    const j = job(find(buildSupportView(open), '早自習跑班'));
    expect(j.target).toBeNull();
    expect(j).toMatchObject({ short: 0, enough: false, canClaim: true });
  });
});

describe('buildSupportView — 分工', () => {
  const data = {
    activities: [
      { 名稱: '新生準備日', 日期: '2026-08-22', 時間: '10:00', 類型: '分工', 狀態: '開放', 需求人數: '', 說明: '', 'LINE連結': '' },
    ],
    jobs: [
      { 活動: '新生準備日', 工作: '主持人', 需求人數: '1', 指定: '黃子玉' },
      { 活動: '新生準備日', 工作: '搬樂器', 需求人數: '4', 指定: '' },
      { 活動: '新生準備日', 工作: '攝影', 需求人數: '1', 指定: '' },
    ],
    responses: [
      { 時間戳記: '1', 活動: '新生準備日', 工作: '搬樂器', 稱呼: '王爸' },
      { 時間戳記: '2', 活動: '新生準備日', 工作: '攝影', 稱呼: '陳媽' },
      { 時間戳記: '3', 活動: '新生準備日', 工作: '搬樂器', 稱呼: '王爸' },
    ],
  };
  it('指定者已內定：assignedFixed、enough、不可認領', () => {
    const j = job(find(buildSupportView(data), '新生準備日'), '主持人');
    expect(j).toMatchObject({ assignedFixed: true, enough: true, canClaim: false });
    expect(j.names).toEqual(['黃子玉']);
  });
  it('開放工作：依報名計算 signed/short，未滿可認領', () => {
    const j = job(find(buildSupportView(data), '新生準備日'), '搬樂器');
    expect(j.names).toEqual(['王爸', '王爸']); // 純邏輯不去重，呈現層處理
    expect(j).toMatchObject({ target: 4, signed: 2, short: 2, enough: false, canClaim: true });
  });
  it('開放工作達標：足夠、不可認領', () => {
    const j = job(find(buildSupportView(data), '新生準備日'), '攝影');
    expect(j).toMatchObject({ target: 1, signed: 1, enough: true, canClaim: false });
  });
  it('total 為跨工作不重複的稱呼數（含內定者；王爸只算一次）', () => {
    // 黃子玉(內定) + 王爸(報名兩次算一次) + 陳媽 = 3
    expect(find(buildSupportView(data), '新生準備日').total).toBe(3);
  });
});

describe('buildSupportView — 狀態、排序、安全、空值', () => {
  it('結束→ended、額滿→full，皆不可認領，結束排最後', () => {
    const view = buildSupportView({
      activities: [
        { 名稱: '已結束', 日期: '2026-01-01', 類型: '接龍', 狀態: '結束', 需求人數: '5' },
        { 名稱: '額滿中', 日期: '2026-12-01', 類型: '接龍', 狀態: '額滿', 需求人數: '5' },
        { 名稱: '開放中', 日期: '2026-07-01', 類型: '接龍', 狀態: '開放', 需求人數: '5' },
      ],
      jobs: [], responses: [],
    });
    expect(view.map((a) => a.name)).toEqual(['開放中', '額滿中', '已結束']); // 未結束依日期升冪、結束殿後
    expect(find(view, '已結束')).toMatchObject({ ended: true });
    expect(job(find(view, '已結束')).canClaim).toBe(false);
    expect(find(view, '額滿中')).toMatchObject({ full: true, open: false });
    expect(job(find(view, '額滿中')).canClaim).toBe(false);
  });
  it('lineUrl 僅保留 http(s)，擋 javascript:', () => {
    const view = buildSupportView({
      activities: [
        { 名稱: 'A', 日期: '2026-07-01', 類型: '接龍', 狀態: '開放', 需求人數: '1', 'LINE連結': 'javascript:alert(1)' },
        { 名稱: 'B', 日期: '2026-07-02', 類型: '接龍', 狀態: '開放', 需求人數: '1', 'LINE連結': 'https://line.me/x' },
      ], jobs: [], responses: [],
    });
    expect(find(view, 'A').lineUrl).toBe('');
    expect(find(view, 'B').lineUrl).toBe('https://line.me/x');
  });
  it('空輸入回空陣列', () => {
    expect(buildSupportView({ activities: [], jobs: [], responses: [] })).toEqual([]);
    expect(buildSupportView({})).toEqual([]);
  });
  it('類型空白預設為接龍', () => {
    const view = buildSupportView({ activities: [{ 名稱: 'X', 日期: '2026-07-01', 需求人數: '2' }], jobs: [], responses: [] });
    expect(find(view, 'X').type).toBe('接龍');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL（`buildSupportView` is not a function / 匯出不存在）。

- [ ] **Step 3: 重寫 `src/lib/support.js`**

寫入（整檔取代）：

```js
import { isSafeHref } from './csv.js';

// 多選／指定欄以逗號、頓號分隔。
function splitItems(cell) {
  return String(cell ?? '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
}

// 需求人數 → 正整數，否則回 fallback（接龍空白為 null＝無上限；分工預設 1）。
function toTarget(v, fallback) {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeStatus(v) {
  const s = String(v ?? '').trim();
  return s === '結束' || s === '額滿' ? s : '開放';
}

// 日期正規化成可比較的 YYYYMMDD（容錯 2026/8/1、2026-08-22 等）。
function dateKey(s) {
  const p = String(s ?? '').match(/\d+/g);
  if (!p || p.length < 3) return '';
  const [y, m, d] = p;
  return y.padStart(4, '0') + m.padStart(2, '0') + d.padStart(2, '0');
}

function makeJob({ label, target, assigned, claimers, activityOpen }) {
  const names = [...assigned, ...claimers];
  const signed = names.length;
  const assignedFixed = assigned.length > 0;
  const enough = assignedFixed || (target != null && signed >= target);
  const short = target != null ? Math.max(0, target - signed) : 0;
  const canClaim = !assignedFixed && activityOpen && !enough;
  return { label, target, assigned, claimers, names, signed, short, enough, assignedFixed, canClaim };
}

// 未結束的依日期升冪在前，結束的依日期降冪殿後（同日期維持輸入順序，sort 穩定）。
function orderActivities(list) {
  const live = list.filter((a) => !a.ended);
  const ended = list.filter((a) => a.ended);
  live.sort((a, b) => (dateKey(a.date) < dateKey(b.date) ? -1 : dateKey(a.date) > dateKey(b.date) ? 1 : 0));
  ended.sort((a, b) => (dateKey(a.date) < dateKey(b.date) ? 1 : dateKey(a.date) > dateKey(b.date) ? -1 : 0));
  return [...live, ...ended];
}

// 把「活動／工作／報名」三組資料列組成兩型看板 view model。
export function buildSupportView({ activities = [], jobs = [], responses = [] } = {}) {
  const jobsByActivity = new Map();
  for (const j of jobs) {
    const key = String(j['活動'] ?? '').trim();
    if (!jobsByActivity.has(key)) jobsByActivity.set(key, []);
    jobsByActivity.get(key).push(j);
  }

  const result = activities.map((act) => {
    const name = String(act['名稱'] ?? '').trim();
    const type = String(act['類型'] ?? '').trim() === '分工' ? '分工' : '接龍';
    const status = normalizeStatus(act['狀態']);
    const open = status === '開放';
    const acResponses = responses.filter((r) => String(r['活動'] ?? '').trim() === name);

    let jobsOut;
    if (type === '分工') {
      jobsOut = (jobsByActivity.get(name) || []).map((def) => {
        const label = String(def['工作'] ?? '').trim();
        const claimers = acResponses
          .filter((r) => String(r['工作'] ?? '').trim() === label)
          .map((r) => String(r['稱呼'] ?? '').trim())
          .filter(Boolean);
        return makeJob({ label, target: toTarget(def['需求人數'], 1), assigned: splitItems(def['指定']), claimers, activityOpen: open });
      });
    } else {
      const claimers = acResponses.map((r) => String(r['稱呼'] ?? '').trim()).filter(Boolean);
      jobsOut = [makeJob({ label: '', target: toTarget(act['需求人數'], null), assigned: [], claimers, activityOpen: open })];
    }

    const lineRaw = String(act['LINE連結'] ?? '').trim();
    return {
      name,
      date: String(act['日期'] ?? '').trim(),
      time: String(act['時間'] ?? '').trim(),
      type,
      status,
      ended: status === '結束',
      full: status === '額滿',
      open,
      note: String(act['說明'] ?? '').trim(),
      lineUrl: isSafeHref(lineRaw) ? lineRaw : '',
      jobs: jobsOut,
      total: new Set(jobsOut.flatMap((j) => j.names)).size,
    };
  });

  return orderActivities(result);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS（全部 green）。

- [ ] **Step 5: Commit（需先經使用者確認）**

```bash
git add src/lib/support.js src/lib/support.test.js
git commit   # K260626J [JimeiGuoyue] Rewrite 活動支援 pure logic for unified job-list model. （含條列 body 與 Release Note）
```

---

## Task 2: 更新開發用範例 CSV

**Files:**
- Create: `public/sample-support-activities.csv`
- Create: `public/sample-support-jobs.csv`
- Modify (重寫): `public/sample-support-responses.csv`

- [ ] **Step 1: 寫入 `public/sample-support-activities.csv`**

```
名稱,日期,時間,類型,狀態,需求人數,說明,LINE連結
早自習跑班招生,2026-06-29,8:00-8:40,接龍,開放,8,需搬樂器、椅子、發傳單,
新生準備日,2026-08-22,10:00-11:00,分工,開放,,各組工作請認領,
家長日演出,2026-09-12,8:00-9:00,分工,開放,,需募集家長與主持人協助,
```

- [ ] **Step 2: 寫入 `public/sample-support-jobs.csv`**

```
活動,工作,需求人數,指定
新生準備日,主持人,1,黃子玉
新生準備日,搬樂器,4,
新生準備日,場佈,3,
新生準備日,攝影,1,
家長日演出,家長協演,6,
家長日演出,主持人,1,
```

- [ ] **Step 3: 重寫 `public/sample-support-responses.csv`**

```
時間戳記,活動,工作,稱呼
2026/6/20 10:00,早自習跑班招生,,侑亭媽
2026/6/20 10:05,早自習跑班招生,,彥辰媽
2026/6/20 10:10,早自習跑班招生,,芳語爸
2026/6/20 10:12,早自習跑班招生,,好恩爸
2026/6/21 09:00,新生準備日,搬樂器,王爸
2026/6/21 09:10,新生準備日,攝影,陳媽
```

- [ ] **Step 4: Commit（需先經使用者確認）**

```bash
git add public/sample-support-activities.csv public/sample-support-jobs.csv public/sample-support-responses.csv
git commit   # K260626K [JimeiGuoyue] Replace 活動支援 sample CSVs for the two-type board.
```

---

## Task 3: Apps Script 參考碼

**Files:**
- Create: `apps-script/support.gs`

說明：此為**整支新檔**，依專案慣例檔案內部不加 KyymmddX tag。它不進 Astro build，由使用者手動貼到 Google Apps Script 部署。

- [ ] **Step 1: 寫入 `apps-script/support.gs`**

```js
// 集美國樂「活動支援」後端：讀三分頁回 JSON（doGet）、寫入報名（doPost）。
// 部署：Apps Script 編輯器 → 部署為「網頁應用程式」→ 執行身分=我、存取權=任何人。
// 部署後把網址填入網站環境變數 PUBLIC_SUPPORT_API_URL。

const SHEET_ID = 'REPLACE_WITH_SPREADSHEET_ID';   // 試算表網址中 /d/ 後那段
const TOKEN = 'REPLACE_WITH_TOKEN';               // 需與網站 PUBLIC_SUPPORT_TOKEN 一致

function doGet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return json({
    activities: readSheet(ss, '活動'),
    jobs: readSheet(ss, '工作'),
    responses: readSheet(ss, '報名'),
  });
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (String(p.token || '') !== TOKEN) return json({ ok: false, error: 'bad token' });
  const activity = String(p.activity || '').slice(0, 100).trim();
  const job = String(p.job || '').slice(0, 100).trim();
  const name = String(p.name || '').slice(0, 50).trim();
  if (!activity || !name) return json({ ok: false, error: 'missing fields' });
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('報名');
  sh.appendRow([new Date(), activity, job, name]);
  return json({ ok: true });
}

function readSheet(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim());
  return values
    .slice(1)
    .map((row) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = row[i] == null ? '' : String(row[i]).trim(); });
      return o;
    })
    .filter((o) => Object.values(o).some((v) => v !== ''));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2: Commit（需先經使用者確認）**

```bash
git add apps-script/support.gs
git commit   # K260626L [JimeiGuoyue] Add Apps Script reference for support read/write.
```

---

## Task 4: 重寫頁面 `src/pages/support.astro` 並移除舊資料檔

**Files:**
- Modify (重寫): `src/pages/support.astro`
- Delete: `src/data/support-events.js`

- [ ] **Step 1: 確認沒有別處還引用舊模組／函式**

Run: `git grep -n "support-events\|summarizeSupport"`
Expected: 僅出現在 `src/pages/support.astro`（即將重寫）。若有其他檔，於本任務一併處理。

- [ ] **Step 2: 重寫 `src/pages/support.astro`**

寫入（整檔取代）：

```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="活動支援">
  <h1>活動支援</h1>
  <p class="muted">需要家長到場支援的活動。直接在下方填稱呼送出即可報名／認領，看板會即時更新。</p>
  <div id="support"><p class="muted">看板載入中…</p></div>
</Layout>
<script>
  import { parseCsvRows } from '../lib/csv.js';
  import { buildSupportView } from '../lib/support.js';

  const API_URL = import.meta.env.PUBLIC_SUPPORT_API_URL || '';
  const TOKEN = import.meta.env.PUBLIC_SUPPORT_TOKEN || '';
  const CSV = {
    activities: import.meta.env.PUBLIC_SUPPORT_ACTIVITIES_CSV || '/sample-support-activities.csv',
    jobs: import.meta.env.PUBLIC_SUPPORT_JOBS_CSV || '/sample-support-jobs.csv',
    responses: import.meta.env.PUBLIC_SUPPORT_RESPONSES_CSV || '/sample-support-responses.csv',
  };
  const root = document.getElementById('support');
  // 文字＋屬性都安全：innerHTML 跳脫 & < >，再補跳脫 " 供屬性使用。
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML.replace(/"/g, '&quot;'); };

  async function fetchViaApi() {
    const res = await fetch(`${API_URL}?action=board`);
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    return { activities: d.activities || [], jobs: d.jobs || [], responses: d.responses || [] };
  }
  async function fetchViaCsv() {
    const get = (u) => fetch(u).then((x) => (x.ok ? x.text() : Promise.reject(new Error(String(x.status)))));
    const [a, j, r] = await Promise.all([get(CSV.activities), get(CSV.jobs), get(CSV.responses)]);
    return { activities: parseCsvRows(a), jobs: parseCsvRows(j), responses: parseCsvRows(r) };
  }
  async function loadData() {
    if (API_URL) { try { return await fetchViaApi(); } catch (e) { /* 退回 CSV */ } }
    return await fetchViaCsv();
  }

  function progress(j) {
    if (j.enough) return '<span class="ok">足夠 ✓</span>';
    const target = j.target != null ? ` / 需 ${j.target}` : '';
    const short = j.short ? `（還缺 ${j.short}）` : '';
    return `<span class="need">已 ${j.signed}${target}${short}</span>`;
  }
  function claimForm(act, label, btn) {
    return `<form class="claim" data-activity="${esc(act.name)}" data-job="${esc(label)}">`
      + `<input name="name" placeholder="您的稱呼，例：侑亭媽" required maxlength="50">`
      + `<button>${esc(btn)}</button></form>`;
  }
  function jobRow(act, j) {
    if (j.assignedFixed) {
      return `<div class="board-row"><span>${esc(j.label)}</span><span class="ok">${j.names.map(esc).join('、')} ✓</span></div>`;
    }
    const names = j.names.length ? `<p class="muted board-thanks">${j.names.map(esc).join('、')}</p>` : '';
    const form = j.canClaim ? claimForm(act, j.label, '認領') : '';
    return `<div class="board-row"><span>${esc(j.label)}</span>${progress(j)}</div>${names}${form}`;
  }
  function rosterCard(act) {
    const j = act.jobs[0];
    const list = j.names.length
      ? `<ol class="signup-list">${j.names.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>`
      : '<p class="muted">還沒有人報名，當第一個吧！</p>';
    const form = j.canClaim
      ? claimForm(act, '', '＋ 我要報名')
      : (act.ended ? '' : '<p class="muted">名額已滿，感謝報名！</p>');
    return list + `<div class="board-row"><span>目前報名</span>${progress(j)}</div>` + form;
  }
  function cardHtml(act) {
    const badge = act.ended ? '<span class="pin">已結束</span>' : act.full ? '<span class="pin">額滿</span>' : '';
    const meta = `<p><time>${esc(act.date)}</time>${act.time ? ` ${esc(act.time)}` : ''}</p>`;
    const note = act.note ? `<p class="muted">${esc(act.note)}</p>` : '';
    const line = act.lineUrl ? `<p><a href="${esc(act.lineUrl)}" target="_blank" rel="noopener noreferrer">LINE 討論串 ↗</a></p>` : '';
    const body = act.type === '分工'
      ? `<div class="board-row"><span>目前支援家長</span><span class="ok">${act.total} 位</span></div>` + act.jobs.map((j) => jobRow(act, j)).join('')
      : rosterCard(act);
    return `<section class="card support-event"><h2>${esc(act.name)} ${badge}</h2>${meta}${note}<div class="board">${body}</div>${line}</section>`;
  }

  let lastJson = '';
  async function render() {
    // 使用者正在輸入時不要重繪，以免清掉打到一半的字。
    if (root.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    try {
      const view = buildSupportView(await loadData());
      const snapshot = JSON.stringify(view);
      if (snapshot === lastJson) return;
      lastJson = snapshot;
      root.innerHTML = view.length ? view.map(cardHtml).join('') : '<p class="muted">目前沒有需要支援的活動。</p>';
    } catch (e) {
      if (!lastJson) root.innerHTML = '<p class="muted">看板載入失敗，請稍後再試。</p>';
    }
  }

  async function onSubmit(form) {
    const name = (form.querySelector('input[name="name"]').value || '').trim();
    if (!name) return;
    const activity = form.getAttribute('data-activity');
    const job = form.getAttribute('data-job') || '';
    const ack = document.createElement('p');
    ack.className = 'muted';
    ack.textContent = `已送出：${name}，感謝支援！`;
    form.replaceWith(ack); // 樂觀更新
    if (!API_URL) return;  // 開發環境（無後端）僅樂觀顯示
    try {
      await fetch(API_URL, { method: 'POST', body: new URLSearchParams({ action: 'signup', activity, job, name, token: TOKEN }) });
    } catch (e) { /* 已樂觀顯示；下次輪詢以伺服器資料校正 */ }
    lastJson = '';
    setTimeout(render, 1500);
  }

  if (root) {
    root.addEventListener('submit', (e) => {
      if (e.target && e.target.classList.contains('claim')) { e.preventDefault(); onSubmit(e.target); }
    });
    render();
    setInterval(() => { if (!document.hidden) render(); }, 30000);
  }
</script>
<style is:global>
  /* 卡片由 client script 以 innerHTML 注入，需全域樣式才套得到（同文件下載頁） */
  .support-event h2{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .signup-list{margin:.3rem 0 .6rem;padding-left:1.5rem}
  .signup-list li{padding:.15rem 0}
  .claim{display:flex;gap:.4rem;margin:.3rem 0 .2rem}
  .claim input{flex:1;min-width:0;padding:.4rem .6rem;border:1px solid var(--line);border-radius:8px;font:inherit}
  .claim button{background:var(--brand);color:#fff;border:0;border-radius:999px;padding:.4rem .9rem;font:inherit;cursor:pointer;white-space:nowrap}
  .claim button:hover{background:var(--brand-dark)}
</style>
```

- [ ] **Step 3: 刪除舊資料檔**

Run: `git rm src/data/support-events.js`

- [ ] **Step 4: 建置確認**

Run: `npm run build`
Expected: 成功，無錯誤（特別是無「找不到 support-events」之類的匯入錯誤）。

- [ ] **Step 5: Commit（需先經使用者確認）**

```bash
git add src/pages/support.astro
git commit   # K260626M [JimeiGuoyue] Rewrite 活動支援 page for in-page sign-up and live board. （body 註明移除 src/data/support-events.js）
```

---

## Task 5: 上線操作清單與專案筆記

**Files:**
- Create: `docs/superpowers/plans/2026-06-26-support-go-live-checklist.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 寫入 `docs/superpowers/plans/2026-06-26-support-go-live-checklist.md`**

```markdown
# 活動支援上線操作清單

對應設計：`docs/superpowers/specs/2026-06-26-support-live-signup-design.md`

## A. 建立 Google 試算表（一次性）
1. 新增一份試算表，建三個分頁：`活動`、`工作`、`報名`。
2. `活動` 第一列標題：`名稱 / 日期 / 時間 / 類型 / 狀態 / 需求人數 / 說明 / LINE連結`。
3. `工作` 第一列標題：`活動 / 工作 / 需求人數 / 指定`。
   - 選取 `活動` 欄 → 資料 → 資料驗證 → 下拉選單（清單來源指向「活動」分頁的名稱），避免打錯。
4. `報名` 第一列標題：`時間戳記 / 活動 / 工作 / 稱呼`（內容由系統自動寫入）。
5. 欄位規則：接龍活動只在「活動」分頁填 `需求人數`；分工活動的 `需求人數` 留空、改在「工作」分頁逐項列。`指定` 有填＝已內定（不開放認領）。`類型`＝接龍/分工；`狀態`＝開放/額滿/結束。

## B. 部署 Apps Script（一次性）
1. 試算表 → 擴充功能 → Apps Script，貼上 `apps-script/support.gs`。
2. 填 `SHEET_ID`（試算表網址 `/d/` 後那段）與 `TOKEN`（自訂一段亂碼）。
3. 部署 → 新增部署作業 → 類型「網頁應用程式」→ 執行身分「我」、存取權「任何人」→ 部署，複製網址。
4. 測試：瀏覽器開 `部署網址?action=board`，應看到 JSON。

## C.（選填）發布 CSV 後備
- 將三分頁各自「檔案 → 共用 → 發布到網路 → CSV」，記下三個網址（doGet 失敗時的後備；可日後再補）。

## D. 設定環境變數並重新部署
於 Cloudflare → Settings → Build → Variables and secrets（**build 變數區**）新增：
- `PUBLIC_SUPPORT_API_URL` = B 的部署網址
- `PUBLIC_SUPPORT_TOKEN` = 與 .gs 內 TOKEN 相同
- （選填）`PUBLIC_SUPPORT_ACTIVITIES_CSV` / `PUBLIC_SUPPORT_JOBS_CSV` / `PUBLIC_SUPPORT_RESPONSES_CSV` = C 的三個網址

設定後需 **push 觸發一次新 build** 才生效（重試舊部署不會帶入新變數）。

## E. 驗收
- 線上開「活動支援」頁，確認接龍與分工兩型都正確顯示。
- 在頁面報名一筆 → 自己立即看到 → 重整另一裝置，數秒內看到（doGet 即時）。
```

- [ ] **Step 2: 更新 `CLAUDE.md` 目前狀態**

於 `CLAUDE.md` 的「目前狀態 / 待辦」區，把活動支援相關敘述更新為：站內即時報名／認領已實作（設計 `2026-06-26-support-live-signup-design.md`、上線清單 `2026-06-26-support-go-live-checklist.md`）；活動定義改由 Google 試算表（活動／工作／報名三分頁）驅動、寫回走 Apps Script、看板即時（doGet→CSV 後備）；環境變數 `PUBLIC_SUPPORT_API_URL`／`PUBLIC_SUPPORT_TOKEN`（＋選填三組後備 CSV）**待使用者設定並重新部署**；並把「活動支援表單與回覆 CSV（support-events.js）」自待補素材清單移除（該檔已刪）。

- [ ] **Step 3: Commit（需先經使用者確認）**

```bash
git add docs/superpowers/plans/2026-06-26-support-go-live-checklist.md CLAUDE.md
git commit   # K260626N [JimeiGuoyue] Add support go-live checklist and update project notes.
```

---

## Task 6: 最終驗證

**Files:** 無（僅驗證，必要時回前面任務修正）

- [ ] **Step 1: 單元測試**

Run: `npm test`
Expected: 全數 PASS。

- [ ] **Step 2: 建置**

Run: `npm run build`
Expected: 成功、無警告錯誤。

- [ ] **Step 3: 預覽驗證（用 preview 工具，非 Bash）**

啟動 dev server（preview_start）→ 開 `/support`。此時無 `PUBLIC_SUPPORT_API_URL`，走 sample CSV。確認：
- 「早自習跑班招生」呈現接龍：編號名單（侑亭媽…）＋「已報 4 / 需 8（還缺 4）」＋「＋ 我要報名」表單。
- 「新生準備日」呈現分工：主持人顯示「黃子玉 ✓」（不可認領）、搬樂器「已 1 / 需 4（還缺 3）」＋認領表單、攝影「足夠 ✓」、場佈「已 0 / 需 3（還缺 3）」。
- 在接龍表單填一個稱呼送出 → 名字立即出現（樂觀更新；dev 無後端不會真的寫入）。
- console 無錯誤（preview_console_logs）。
- 截圖存證（preview_screenshot）。

- [ ] **Step 4: 若有問題**

回對應任務修正後重跑本任務；最終確保 test／build／預覽皆綠。
```

---

## Self-Review（對照 spec）

- **§4 資料流**：Task 4 頁面實作 doGet→CSV 後備、doPost 送出、輪詢；Task 1 集中組裝邏輯。✓
- **§5 試算表結構**：Task 5 清單建立三分頁＋資料驗證；Task 1 欄位名（名稱/日期/時間/類型/狀態/需求人數/說明/LINE連結；活動/工作/需求人數/指定；時間戳記/活動/工作/稱呼）一致。✓
- **§6 兩型呈現**：Task 4 `rosterCard`（接龍）／`jobRow`（分工、含指定 ✓）。✓
- **§7 報名流程**：Task 4 樂觀更新＋送出＋輪詢校正。✓
- **§8 安全**：`esc()` 補跳脫 `"`、`isSafeHref`（lib）、token、輪詢分頁隱藏暫停。✓
- **§9 檔案／環境變數／測試**：Task 1–5 對齊；`support-events.js` 刪除（Task 4）。✓
- **§10 邊界**：結束/額滿不可認領（Task 1 旗標＋Task 4 呈現）、達標自動收表單。✓
- **§11 上線待辦**：Task 5 清單。✓
- **型別一致**：view model 欄位（`canClaim`、`assignedFixed`、`enough`、`short`、`target`、`names`、`total`…）在 Task 1 定義、Task 1 測試與 Task 4 頁面使用一致。✓
- **無 Placeholder**：測試、lib、頁面、.gs、清單均為完整可執行內容（`.gs` 內 `REPLACE_WITH_*` 為使用者部署時填的設定值，非程式空白）。✓
