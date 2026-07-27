# 首頁「重要活動倒數」卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首頁右欄「近期行程」上方加一張倒數卡，把幹部在 Google 日曆標題加了 `★` 的活動拉出來，以「還有 N 天」呈現。

**Architecture:** 判定、清理、挑選、算天數全部做成 `src/lib/events.js` 的純函式（不碰 DOM、`now` 由外部注入），配 vitest。`fetchUpcoming` 改成回傳完整的未來活動排序清單，首頁 client script 用同一份資料同時餵「近期行程 5 列」與「倒數卡」，不新增任何 API 請求。版面用 `grid-template-areas` 讓手機能把倒數卡提到公告之前。

**Tech Stack:** Astro（靜態）＋原生 JS／CSS；vitest 單元測試；Google Calendar API（前端 fetch）。

**Spec:** `docs/superpowers/specs/2026-07-27-home-featured-countdown-design.md`

## Global Constraints

- **不加行內修改 tag**：本專案是網頁專案，**不套用**全域 CLAUDE.md 的 `//KyymmddX+` 行內 tag 規則。程式碼保持乾淨，只有 commit 訊息用 `KyymmddX` 格式。
- **commit 訊息格式**：`KyymmddX [JimeiGuoyue] 英文標題.`，body 英文條列，空一行後附 `Release Note:` 的 a/b/c 三點（PM 視角、無技術術語）。
- **⚠️ 每次 `git commit` 前必須先把訊息拿給使用者確認，得到 OK 才能執行。** 本計畫每個 Task 的 commit 步驟都適用。
- **純邏輯隔離**：`src/lib/events.js` 不得 import DOM、不得呼叫 `new Date()` 取現在時間——`now` 一律由呼叫端注入，否則無法測試。
- **防 XSS**：client script 組 `innerHTML` 前，所有來自 Google 的字串一律先過 `esc()`。
- **UI 文案用繁體中文**；程式碼註解用中文（本專案 `src/lib/` 既有慣例），commit 訊息用英文。
- **標記字元**：`FEATURED_MARKERS = ['★', '⭐', '【重要】']`，文件只教 `★`。
- **顯示上限**：倒數卡合計最多 3 筆（1 大卡 + 2 小列）。
- **抓取上限**：每個日曆 `maxResults=50`。

---

### Task 1: 標記判定與清理

把「標題含 `★`」變成資料上的一個布林欄位，並讓標記字元不出現在畫面上。

**Files:**
- Modify: `src/lib/events.js`（新增 `FEATURED_MARKERS`／`isFeatured`／`stripMarker`；改 `normalize`，約 30-34 行）
- Test: `src/lib/events.test.js`

**Interfaces:**
- Consumes: 既有的 `parseStart(item)`
- Produces:
  - `isFeatured(title: string) -> boolean`
  - `stripMarker(title: string) -> string`
  - `normalize(item, calMeta)` 回傳物件新增 `featured: boolean`，且 `title` 已移除標記

- [ ] **Step 1: 寫失敗測試**

在 `src/lib/events.test.js` 檔案頂端的 import 清單加入 `isFeatured`、`stripMarker`：

```js
import {
  parseStart,
  normalize,
  isFeatured,
  stripMarker,
  toUpcoming,
  takeNext,
  formatMonthDay,
  formatWeekday,
  formatTime,
  fetchCalendarEvents,
  fetchUpcoming,
} from './events.js';
```

在 `describe('normalize', ...)` 區塊**之後**插入：

```js
describe('isFeatured', () => {
  it('recognises the documented ★ marker', () => {
    expect(isFeatured('★新生體驗招生活動')).toBe(true);
  });
  it('also accepts the tolerated ⭐ and 【重要】 variants', () => {
    expect(isFeatured('⭐校慶音樂會')).toBe(true);
    expect(isFeatured('【重要】校慶音樂會')).toBe(true);
  });
  it('accepts the marker typed at the end of the title', () => {
    expect(isFeatured('校慶音樂會★')).toBe(true);
  });
  it('is false for a plain title, empty string, and missing input', () => {
    expect(isFeatured('常態團練')).toBe(false);
    expect(isFeatured('')).toBe(false);
    expect(isFeatured(undefined)).toBe(false);
  });
});

describe('stripMarker', () => {
  it('removes the marker and the whitespace it leaves behind', () => {
    expect(stripMarker('★新生體驗招生活動')).toBe('新生體驗招生活動');
    expect(stripMarker('★ 新生體驗招生活動')).toBe('新生體驗招生活動');
    expect(stripMarker('【重要】校慶音樂會')).toBe('校慶音樂會');
    expect(stripMarker('校慶音樂會★')).toBe('校慶音樂會');
  });
  it('leaves an unmarked title untouched', () => {
    expect(stripMarker('常態團練')).toBe('常態團練');
  });
  it('returns an empty string when the title is only a marker', () => {
    expect(stripMarker('★')).toBe('');
  });
});

describe('normalize (featured flag)', () => {
  const cal = { name: '全團常態課與展演', color: '#e4c441' };
  it('strips the marker from the title and flags the event as featured', () => {
    const ev = normalize({ summary: '★新生體驗招生活動', start: { date: '2026-08-22' } }, cal);
    expect(ev.title).toBe('新生體驗招生活動');
    expect(ev.featured).toBe(true);
  });
  it('flags a plain event as not featured', () => {
    const ev = normalize({ summary: '常態團練', start: { date: '2026-08-22' } }, cal);
    expect(ev.title).toBe('常態團練');
    expect(ev.featured).toBe(false);
  });
  it('falls back to the placeholder title when only a marker was typed', () => {
    const ev = normalize({ summary: '★', start: { date: '2026-08-22' } }, cal);
    expect(ev.title).toBe('(無標題)');
    expect(ev.featured).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
npm test -- --run src/lib/events.test.js
```

Expected: FAIL，訊息類似 `isFeatured is not a function` / `stripMarker is not a function`。

- [ ] **Step 3: 實作**

在 `src/lib/events.js` 的 `parseStart` 之後、`normalize` 之前插入：

```js
// 幹部在日曆活動標題加標記＝重要活動。文件只教 ★，其餘為容錯（打成別的也不會失效）。
export const FEATURED_MARKERS = ['★', '⭐', '【重要】'];

export function isFeatured(title) {
  const s = String(title ?? '');
  return FEATURED_MARKERS.some((m) => s.includes(m));
}

// 標記只存在於 Google 端，畫面上一律顯示乾淨標題。
export function stripMarker(title) {
  let s = String(title ?? '');
  for (const m of FEATURED_MARKERS) s = s.split(m).join('');
  return s.trim();
}
```

再把既有的 `normalize` 整個換成：

```js
export function normalize(item, calMeta) {
  const { at, isAllDay } = parseStart(item);
  const raw = (item.summary ?? '').trim();
  const title = stripMarker(raw) || '(無標題)';
  return { title, at, isAllDay, color: calMeta.color, calName: calMeta.name, featured: isFeatured(raw) };
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
npm test -- --run src/lib/events.test.js
```

Expected: PASS，全部綠（含既有的 `normalize` 兩個舊測試——`toMatchObject` 只比對列出的欄位，多一個 `featured` 不會失敗）。

- [ ] **Step 5: Commit（先請使用者確認訊息）**

```bash
git add src/lib/events.js src/lib/events.test.js
```

擬好 `KyymmddX [JimeiGuoyue] Recognise ★-marked calendar events as featured.` 形式的訊息（含 Release Note a/b/c），**經使用者 OK 後**再 `git commit`。

---

### Task 2: 倒數天數與文案

用台北日界線算整數天，避免「明天早上 8 點」因為現在幾點而顯示成 0 天或 2 天。

**Files:**
- Modify: `src/lib/events.js`（新增 `daysUntil`／`formatCountdown`，放在 `formatTime` 之後）
- Test: `src/lib/events.test.js`

**Interfaces:**
- Consumes: 檔案內既有的私有函式 `startOfTaipeiDay(date)`（第 18-22 行，不需 export，同檔可直接呼叫）
- Produces:
  - `daysUntil(at: Date, now: Date) -> number`（今天 0、明天 1）
  - `formatCountdown(days: number) -> string`

- [ ] **Step 1: 寫失敗測試**

在 `src/lib/events.test.js` 的 import 清單加入 `daysUntil`、`formatCountdown`，並在 `describe('formatting (Asia/Taipei)', ...)` 區塊之後插入：

```js
describe('daysUntil (Asia/Taipei day boundary)', () => {
  it('counts today as 0 no matter the time of day', () => {
    expect(daysUntil(new Date('2026-07-27T23:30:00+08:00'), new Date('2026-07-27T00:30:00+08:00'))).toBe(0);
  });
  it('counts tomorrow as 1 even late tonight', () => {
    expect(daysUntil(new Date('2026-07-28T08:00:00+08:00'), new Date('2026-07-27T23:00:00+08:00'))).toBe(1);
  });
  it('counts across a month boundary', () => {
    expect(daysUntil(new Date('2026-08-22T00:00:00+08:00'), new Date('2026-07-27T12:00:00+08:00'))).toBe(26);
  });
  it('counts across a year boundary', () => {
    expect(daysUntil(new Date('2027-01-03T00:00:00+08:00'), new Date('2026-12-30T12:00:00+08:00'))).toBe(4);
  });
  it('is negative for a past day', () => {
    expect(daysUntil(new Date('2026-07-26T00:00:00+08:00'), new Date('2026-07-27T12:00:00+08:00'))).toBe(-1);
  });
});

describe('formatCountdown', () => {
  it('says 就是今天 for 0 and for anything already past', () => {
    expect(formatCountdown(0)).toBe('就是今天');
    expect(formatCountdown(-1)).toBe('就是今天');
  });
  it('says 明天 for 1', () => {
    expect(formatCountdown(1)).toBe('明天');
  });
  it('says 還有 N 天 for larger gaps', () => {
    expect(formatCountdown(26)).toBe('還有 26 天');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
npm test -- --run src/lib/events.test.js
```

Expected: FAIL，`daysUntil is not a function`。

- [ ] **Step 3: 實作**

在 `src/lib/events.js` 的 `formatTime` 之後插入：

```js
// 以「台北當日 00:00」相減，同一場活動不會因為現在幾點而變天數。
export function daysUntil(at, now) {
  return Math.round((startOfTaipeiDay(at) - startOfTaipeiDay(now)) / 86400000);
}

export function formatCountdown(days) {
  if (days <= 0) return '就是今天';
  if (days === 1) return '明天';
  return `還有 ${days} 天`;
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
npm test -- --run src/lib/events.test.js
```

Expected: PASS。

- [ ] **Step 5: Commit（先請使用者確認訊息）**

```bash
git add src/lib/events.js src/lib/events.test.js
```

訊息形如 `KyymmddX [JimeiGuoyue] Add Taipei-day-boundary countdown helpers.`，**經使用者 OK 後**再 commit。

---

### Task 3: 挑選重要活動 ＋ 放寬抓取範圍

倒數卡與「近期行程」共用同一次 fetch，所以 `fetchUpcoming` 不再自己截斷，並把每個日曆的抓取上限提高到 50 筆（否則 8/22 這種活動會被密集的暑訓課表擠出範圍而抓不到）。

**Files:**
- Modify: `src/lib/events.js`（新增 `pickFeatured`；改 `fetchCalendarEvents` 的 `maxResults` 預設值；改 `fetchUpcoming` 回傳值）
- Test: `src/lib/events.test.js`

**Interfaces:**
- Consumes: `toUpcoming(events, now)`（既有）
- Produces:
  - `pickFeatured(events: Event[], limit = 3) -> Event[]`（`events` 須為 `toUpcoming` 排序後的結果）
  - `fetchUpcoming(calendars, { apiKey, now, fetchImpl })` **回傳完整**未來活動排序清單（不再接受 `count`，取數交給呼叫端）

- [ ] **Step 1: 寫失敗測試**

在 import 清單加入 `pickFeatured`。在 `describe('takeNext', ...)` 之後插入：

```js
describe('pickFeatured', () => {
  const ev = (title, featured, at) => ({ title, featured, at: new Date(at) });
  const list = [
    ev('常態團練', false, '2026-07-28T09:00:00+08:00'),
    ev('新生體驗招生活動', true, '2026-08-22T00:00:00+08:00'),
    ev('胡琴課', false, '2026-08-25T09:00:00+08:00'),
    ev('校慶音樂會', true, '2026-09-13T00:00:00+08:00'),
    ev('全國賽', true, '2026-10-05T00:00:00+08:00'),
    ev('冬令營', true, '2027-01-20T00:00:00+08:00'),
  ];
  it('keeps only featured events, in the order given, capped at 3 by default', () => {
    expect(pickFeatured(list).map((e) => e.title)).toEqual(['新生體驗招生活動', '校慶音樂會', '全國賽']);
  });
  it('returns an empty array when nothing is featured', () => {
    expect(pickFeatured([ev('常態團練', false, '2026-07-28T09:00:00+08:00')])).toEqual([]);
  });
  it('honours an explicit limit', () => {
    expect(pickFeatured(list, 1).map((e) => e.title)).toEqual(['新生體驗招生活動']);
  });
  it('returns an empty array for an empty list', () => {
    expect(pickFeatured([])).toEqual([]);
  });
});
```

在 `describe('fetchCalendarEvents', ...)` 區塊內，最後一個 `it` 之後插入：

```js
  it('requests up to 50 events per calendar so a distant featured event is still found', async () => {
    let calledUrl;
    const fakeFetch = async (u) => { calledUrl = u; return { ok: true, json: async () => ({ items: [] }) }; };
    await fetchCalendarEvents({ id: 'a', name: 'A', color: '#0' }, { apiKey: 'K', now: NOW, fetchImpl: fakeFetch });
    expect(calledUrl).toContain('maxResults=50');
  });
```

在 `describe('fetchUpcoming', ...)` 區塊內，把三個既有測試呼叫中的 `count: 5,` 刪掉（參數已不存在），並在區塊最後補一個測試證明不再截斷：

```js
  it('returns the full sorted list so callers can slice it themselves', async () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      summary: `E${i}`,
      start: { dateTime: `2026-07-${String(10 + i).padStart(2, '0')}T10:00:00+08:00` },
    }));
    const fakeFetch = async () => ({ ok: true, json: async () => ({ items }) });
    const out = await fetchUpcoming([{ id: 'a', name: 'A', color: '#0' }], { apiKey: 'K', now: NOW, fetchImpl: fakeFetch });
    expect(out).toHaveLength(8);
    expect(out.map((e) => e.title)).toEqual(['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']);
  });
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
npm test -- --run src/lib/events.test.js
```

Expected: FAIL — `pickFeatured is not a function`，以及 `maxResults=50` 與 `toHaveLength(8)` 兩個斷言不成立（目前是 `maxResults=10`、回傳被截成 5 筆）。

- [ ] **Step 3: 實作**

在 `src/lib/events.js` 的 `takeNext` 之後插入：

```js
// events 須為 toUpcoming 排序後的結果；時間最近的重要活動排最前。
export function pickFeatured(events, limit = 3) {
  return events.filter((ev) => ev.featured).slice(0, limit);
}
```

把 `fetchCalendarEvents` 的簽章預設值由 `maxResults = 10` 改成 `maxResults = 50`：

```js
export async function fetchCalendarEvents(calendar, { apiKey, now, maxResults = 50, fetchImpl = fetch } = {}) {
```

把 `fetchUpcoming` 整個換成（拿掉 `count`、不再 `takeNext`）：

```js
// 容錯：單一日曆失敗（如未設公開）只少那一個，仍回傳其餘日曆的活動；全部失敗才丟出。
// 回傳「完整」的未來活動排序清單——首頁要用同一份資料同時餵近期行程與重要活動倒數，取數交給呼叫端。
export async function fetchUpcoming(calendars, { apiKey, now, fetchImpl = fetch } = {}) {
  const results = await Promise.allSettled(
    calendars.map((c) => fetchCalendarEvents(c, { apiKey, now, fetchImpl }))
  );
  const ok = results.filter((r) => r.status === 'fulfilled');
  if (ok.length === 0) throw results[0]?.reason ?? new Error('行事曆載入失敗');
  const events = ok.flatMap((r) => r.value);
  return toUpcoming(events, now);
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
npm test -- --run src/lib/events.test.js
```

Expected: PASS。

> ⚠️ 此時 `src/pages/index.astro` 仍以為 `fetchUpcoming` 只回 5 筆，首頁會列出全部活動。Task 4 會修正——這兩個 Task 之間網站是半成品狀態，**不要**在這裡跑 `npm run build` 當驗收。

- [ ] **Step 5: Commit（先請使用者確認訊息）**

```bash
git add src/lib/events.js src/lib/events.test.js
```

訊息形如 `KyymmddX [JimeiGuoyue] Return the full upcoming list and widen the calendar fetch window.`，**經使用者 OK 後**再 commit。

---

### Task 4: 首頁倒數卡

**Files:**
- Modify: `src/data/sample-events.js`（加兩筆 `★` 範例，讓本機無金鑰時看得到卡片）
- Modify: `src/pages/index.astro`（卡片容器 DOM、client script、`<style>` 版面、`<style is:global>` 卡片樣式）

**Interfaces:**
- Consumes: Task 1-3 的 `pickFeatured(events, limit)`、`daysUntil(at, now)`、`formatCountdown(days)`、`isFeatured`／`stripMarker`（後兩者由 `normalize` 內部使用，首頁不直接呼叫）；既有的 `toUpcoming`、`takeNext`、`formatMonthDay`、`formatWeekday`
- Produces: DOM 節點 `#home-featured`（`<section class="home-col-feat" hidden>`），有重要活動時才 `hidden = false`

- [ ] **Step 1: 範例資料補兩筆重要活動**

在 `src/data/sample-events.js` 的 `raw` 陣列末端（`'暑訓成果發表會'` 那行之後）加兩行：

```js
    ['全團常態課與展演', '★新生體驗招生活動', { date: d(26) }],
    ['全團常態課與展演', '★校慶音樂會', { dateTime: `${d(48)}T14:00:00+08:00` }],
```

兩筆的用意：`d(26)` 撐大卡、`d(48)` 撐小字列，本機開發時兩種呈現都看得到。

- [ ] **Step 2: 加入卡片容器 DOM**

在 `src/pages/index.astro` 的 `.home-cols` 內，把左欄 `<section>`（最新公告那個，第 36 行）加上 class，並在它與 `.home-col-side` 之間插入倒數卡容器：

```astro
  <div class="home-cols">
    <section class="home-col-main">
      <h2 class="sec-head first"><span class="sec-dot brand"></span>最新公告</h2>
```

（左欄其餘內容不動，維持到它的 `</section>`）

接著在該 `</section>` 與 `<section class="home-col-side">` 之間插入：

```astro
    <section class="home-col-feat" id="home-featured" hidden></section>
```

- [ ] **Step 3: 改 client script**

把 `src/pages/index.astro` 第一個 `<script>` 區塊（第 83-111 行，處理 `home-events` 那個）整個換成：

```astro
<script>
  import { calendars } from '../data/calendars.js';
  import { fetchUpcoming, toUpcoming, takeNext, pickFeatured, daysUntil, formatCountdown, formatMonthDay, formatWeekday, formatTime } from '../lib/events.js';
  import { sampleEvents } from '../data/sample-events.js';

  const el = document.getElementById('home-events');
  const featEl = document.getElementById('home-featured');
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  const rowHtml = (ev) =>
    `<div class="ev-row"><div class="ev-date"><div class="md">${esc(formatMonthDay(ev.at))}</div><div class="wd">${esc(formatWeekday(ev.at))}</div></div><span class="ev-dot" style="background:${ev.color}"></span><div class="ev-title">${esc(ev.title)}</div><div class="ev-time">${esc(formatTime(ev))}</div></div>`;

  // 第一筆做大卡（天數＋名稱＋日期），其餘壓成小字列。
  const featHtml = (list, now) => {
    const [main, ...rest] = list;
    const restHtml = rest
      .map((ev) => `<div class="feat-row"><span class="feat-row-date">${esc(formatMonthDay(ev.at))}</span><span class="feat-row-title">${esc(ev.title)}</span><span class="feat-row-days">${esc(String(daysUntil(ev.at, now)))} 天</span></div>`)
      .join('');
    return `<div class="card feat-card"><p class="feat-eyebrow">重要活動</p><p class="feat-count">${esc(formatCountdown(daysUntil(main.at, now)))}</p><h3 class="feat-title">${esc(main.title)}</h3><p class="feat-when">${esc(formatMonthDay(main.at))}（${esc(formatWeekday(main.at))}）</p>${restHtml ? `<div class="feat-rest">${restHtml}</div>` : ''}</div>`;
  };

  if (el) {
    const apiKey = import.meta.env.PUBLIC_GOOGLE_API_KEY;
    const now = new Date();
    try {
      let all, isSample = false;
      if (apiKey) {
        all = await fetchUpcoming(calendars, { apiKey, now });
      } else {
        all = toUpcoming(sampleEvents(now), now);
        isSample = true;
      }
      const events = takeNext(all, 5);
      el.innerHTML = events.length
        ? events.map(rowHtml).join('') + (isSample ? '<p class="upcoming-sample">（範例資料，設定 API 金鑰後顯示真實行程）</p>' : '')
        : '<p class="muted">近期暫無安排，請見完整行事曆。</p>';

      const featured = pickFeatured(all, 3);
      if (featEl && featured.length) {
        featEl.innerHTML = featHtml(featured, now);
        featEl.hidden = false;
      }
    } catch (e) {
      el.innerHTML = '<p class="muted">行程載入失敗。</p>';
    }
  }
</script>
```

改動重點：多 import 三個函式、`fetchUpcoming` 不再傳 `count`、範例分支改用 `toUpcoming(...)` 取完整清單、取 5 筆改在此處做、最後多一段渲染倒數卡。fetch 失敗時 `featEl` 維持 `hidden`（catch 區不碰它）。

- [ ] **Step 4: 改版面（scoped `<style>`）**

在 `src/pages/index.astro` 的 scoped `<style>` 區塊中，把第 161 行的 `.home-cols` 那一行換成：

```css
  .home-cols{display:grid;grid-template-columns:1.6fr 1fr;grid-template-areas:"ann feat" "ann up";gap:0 28px;align-items:start}
  .home-col-main{grid-area:ann}
  .home-col-feat{grid-area:feat;margin:8px 0 22px}
  .home-col-feat[hidden]{display:none}
  .home-col-side{grid-area:up}
```

`margin-top:8px` 讓卡片上緣與左欄「最新公告」標題（`.sec-head.first` 的 `margin-top:8px`）對齊；`margin-bottom:22px` 是與下方「近期行程」標題的間距。沒有重要活動時 `[hidden]` → `display:none`，grid 列高為 0，版面完全回到現行樣子。

同一個 `<style>` 區塊的 `@media(max-width:720px)` 內，把 `.home-cols{grid-template-columns:1fr}` 那一行換成：

```css
    .home-cols{grid-template-columns:1fr;grid-template-areas:"feat" "ann" "up"}
```

手機順序因此變成：倒數卡 → 公告 → 近期行程。該 media query 內既有的 `.home-col-side .sec-head.first{margin-top:34px}` 保留不動。

- [ ] **Step 5: 加卡片樣式（`<style is:global>`）**

卡片由 client script 以 `innerHTML` 注入，Astro 的 scoped 樣式套不到，必須放全域區塊。在 `src/pages/index.astro` 檔尾 `<style is:global>` 內，`.upcoming-sample` 那行之後加入：

```css
  .feat-card{padding:16px 22px 18px;border-top:3px solid var(--seal)}
  .feat-eyebrow{margin:0;font-size:11px;letter-spacing:.28em;color:var(--seal);font-weight:700}
  .feat-count{margin:9px 0 0;font-family:"Noto Serif TC",serif;font-size:30px;font-weight:700;line-height:1.15;color:var(--seal)}
  .feat-title{margin:6px 0 0;font-family:"Noto Serif TC",serif;font-size:17px;font-weight:600;color:var(--ink)}
  .feat-when{margin:4px 0 0;font-size:13px;color:var(--faint)}
  .feat-rest{margin-top:13px;padding-top:10px;border-top:1px solid var(--line-soft)}
  .feat-row{display:flex;align-items:center;gap:10px;padding:4px 0;font-size:13px}
  .feat-row-date{flex:none;width:38px;font-weight:700;color:var(--ink)}
  .feat-row-title{flex:1;min-width:0;color:#5a4f3a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .feat-row-days{flex:none;color:var(--faint)}
```

`.feat-row-title` 的 `text-overflow:ellipsis` 是超長活動名稱的防破版保險。

- [ ] **Step 6: 跑測試與建置**

```bash
npm test -- --run
```

Expected: PASS（`src/lib/` 全部測試綠）。

```bash
npm run build
```

Expected: 建置成功、無錯誤。

- [ ] **Step 7: Commit（先請使用者確認訊息）**

```bash
git add src/data/sample-events.js src/pages/index.astro
```

訊息形如 `KyymmddX [JimeiGuoyue] Add a featured-event countdown card above the home page schedule.`，**經使用者 OK 後**再 commit。

---

### Task 5: 端對端驗證

用建置後的靜態站截圖比對，而不是 dev server。

**Files:** 無（純驗證）

**Interfaces:**
- Consumes: Task 4 建置產物 `dist/`

- [ ] **Step 1: 啟動靜態預覽**

⚠️ 依既有經驗（記憶 `jimei-preview-verify`）：**不要**用 `npm run dev` 截圖，HMR 會讓截圖逾時。

```bash
npm run build
```

再用 preview 工具開 `npm run preview` 的網址（預設 http://localhost:4322 ，實際 port 以指令輸出為準）。

- [ ] **Step 2: 停掉 hero 輪播再截圖**

首頁 hero 的無限輪播動畫會讓截圖逾時。截圖前先在頁面執行：

```js
for (let i = 1; i < 9999; i++) window.clearInterval(i);
```

- [ ] **Step 3: 桌機版驗收**

視窗明確設為 1280×800（預設 800 寬會落入手機版，記憶 `jimei-preview-verify`）。截圖確認：

- 倒數卡在右欄最上方，上緣與左欄「最新公告」標題大致齊平
- 卡片依序顯示：「重要活動」小字 → 朱紅大字天數 → 活動名稱 → `M/D（週X）`
- 分隔線下有一列小字（`M/D　校慶音樂會　N 天`）
- 「近期行程」卡在倒數卡下方，內容與改版前一致（5 列、圖例、「看完整行事曆 →」）

- [ ] **Step 4: 手機版驗收**

視窗設為 375×812，截圖確認**倒數卡排在「最新公告」之上**（這是本次刻意的手機重排）。

- [ ] **Step 5: 空狀態驗收**

暫時把 `src/data/sample-events.js` 剛加的兩行 `★` 前綴刪掉（保留活動本身），重跑 `npm run build` 與預覽，確認：

- 倒數卡完全不出現
- 桌機版面與改版前一模一樣（右欄頂端就是「近期行程」標題）

確認後把 `★` 改回來，再跑一次 `npm run build`。

- [ ] **Step 6: 回報結果**

把桌機與手機截圖給使用者看，一併說明：真實站上要看到卡片，幹部得先在某個日曆的活動標題前加 `★`；在那之前線上會是「卡片不出現」的狀態（與現行版面相同）。

---

## 上線後的一次性動作（使用者／幹部端，非程式）

1. 到 Google 日曆，把「新生體驗招生活動」的標題改成 `★新生體驗招生活動`。
2. 重新整理首頁，確認倒數卡出現且天數正確。
3. 把用法告知其他幹部：**標題前加一個 `★` 就會被拉到首頁倒數**，活動過了自動消失，想取消就把 `★` 刪掉。
