# 暑訓專區「暑訓教室」表格 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/summer`（暑訓專區）頁的行事曆與練習作業之間，新增一區用站上風格重製的「暑訓教室」表格（分部／教室／老師 ＋ 3 條注意事項）。

**Architecture:** 資料放 `src/data/summer.js` 的新 `classrooms` 物件（半靜態，幹部每年更新）；`src/pages/summer.astro` 於 build 時渲染成原生 `<table>`；純版面＋靜態資料，Astro 自動跳脫，無 client script、無 XSS 疑慮。

**Tech Stack:** Astro（靜態渲染）＋原生 HTML/CSS；視覺 token 來自 `src/styles/global.css`。

## Global Constraints

- **不加 vitest**：本功能無 `src/lib/` 純邏輯，僅靜態資料＋版面；驗證走 `npm run build` ＋ 瀏覽器預覽（與現有暑訓作業／行事曆一致）。不要為它捏造測試。
- **不嵌行內程式碼 tag**：本專案為網頁專案，不套用全域 `//KyymmddX+` tag 規則；程式碼保持乾淨，只有 commit 訊息用 `KyymmddX`。
- **commit 前需使用者確認**：不可自動 commit。
- **分部標籤照原圖暑訓用語**（竹笛／二胡／揚打／國樂小藝星…），不改成關於我們頁的分部名。
- **老師名用「陳珮珊」**（古箏/大提琴），與站上師資頁一致。
- **視覺 token**（勿寫死色碼）：`--brand`#1F7A4D、`--gold`、`--seal`、`--ink`、`--muted`、`--line-soft`、`#fff` 表頭字。

---

### Task 1: 新增暑訓教室資料＋渲染表格＋調整區段色

**Files:**
- Modify: `src/data/summer.js`（在 `summer` 物件內、`scheduleNote` 之後、`assignmentsNote` 之前插入 `classrooms`）
- Modify: `src/pages/summer.astro`（行事曆卡與練習作業 sec-head 之間插入新 section；練習作業 `sec-dot gold`→`seal`；`<style>` 內新增表格樣式）

**Interfaces:**
- Produces: `summer.classrooms = { title: string, rows: Array<{part:string, room:string, teacher:string}>, notes: string[] }`，供 `summer.astro` 讀取渲染。
- Consumes: 既有 `PageHero`、`.sec-head`／`.sec-dot`／`.sec-note`／`.card` 共用樣式與 `global.css` token。

---

- [ ] **Step 1: 在 `src/data/summer.js` 新增 `classrooms` 資料**

在 `scheduleNote: '...'` 那段結束的逗號之後、`// 練習作業說明` 註解之前，插入：

```js
  // 暑訓教室：各分部上課教室（半靜態，每年暑假由幹部依當年教室分配更新）
  // part 分部標籤照幹部暑訓表用語；title 為表格上方副標；notes 為表格下方注意事項
  classrooms: {
    title: '115（2026）7–8 月各分部上課教室。',
    rows: [
      { part: '竹笛',              room: '107',    teacher: '吳彥志 老師' },
      { part: '二胡',              room: '音樂教室', teacher: '蔡炫沅 老師' },
      { part: '彈撥',              room: '多元教室', teacher: '王子云 老師' },
      { part: '揚打',              room: '合奏教室', teacher: '張哲瑋 老師' },
      { part: '笙',                room: '109',    teacher: '吳欣晏 老師' },
      { part: '古箏/大提琴',        room: '110',    teacher: '陳珮珊 老師' },
      { part: '合奏（10:30–12:00）', room: '合奏教室', teacher: '蔡炫沅 老師' },
      { part: '國樂小藝星',         room: '108',    teacher: '黃子玉 老師' },
    ],
    notes: [
      '班群教室桌椅物品要歸位，勿動教室內的東西。',
      '垃圾要帶走。',
      '合奏教室、國樂教室的樂器及桌椅等各項物品使用，上下課都要協助搬運及歸位。',
    ],
  },
```

- [ ] **Step 2: 在 `src/pages/summer.astro` 插入「暑訓教室」section**

在行事曆 `</a>`（現況第 19 行）之後、`<h2 class="sec-head"><span class="sec-dot gold"></span>練習作業</h2>` 之前，插入：

```astro

    <h2 class="sec-head"><span class="sec-dot gold"></span>暑訓教室</h2>
    {summer.classrooms && (
      <>
        {summer.classrooms.title && <p class="sec-note">{summer.classrooms.title}</p>}
        <section class="card classroom">
          <div class="classroom-scroll">
            <table class="classroom-table">
              <thead>
                <tr><th>分部</th><th>教室</th><th>老師</th></tr>
              </thead>
              <tbody>
                {summer.classrooms.rows.map((r) => (
                  <tr>
                    <td class="cr-part">{r.part}</td>
                    <td>{r.room}</td>
                    <td>{r.teacher}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summer.classrooms.notes.length > 0 && (
            <ul class="classroom-notes">
              {summer.classrooms.notes.map((n) => <li>{n}</li>)}
            </ul>
          )}
        </section>
      </>
    )}
```

- [ ] **Step 3: 練習作業區段圓點由 `gold` 改 `seal`**

把：

```astro
    <h2 class="sec-head"><span class="sec-dot gold"></span>練習作業</h2>
```

改成：

```astro
    <h2 class="sec-head"><span class="sec-dot seal"></span>練習作業</h2>
```

（結果：行事曆綠 → 教室金 → 練習作業朱紅，維持全站輪替。）

- [ ] **Step 4: 在 `summer.astro` 的 `<style>` 內新增表格樣式**

於 `.schedule-hint{...}` 樣式規則之後（或 `<style>` 區塊內任一處）加入：

```css
  .classroom{padding:18px 20px}
  .classroom-scroll{overflow-x:auto}
  .classroom-table{width:100%;border-collapse:collapse;font-size:14.5px;min-width:300px}
  .classroom-table th,.classroom-table td{padding:11px 14px;text-align:left;vertical-align:middle}
  .classroom-table thead th{background:var(--brand);color:#fff;font-family:"Noto Serif TC",serif;font-weight:700;font-size:14px}
  .classroom-table thead th:first-child{border-top-left-radius:10px}
  .classroom-table thead th:last-child{border-top-right-radius:10px}
  .classroom-table tbody tr:nth-child(even){background:rgba(120,90,40,.045)}
  .classroom-table tbody td{border-bottom:1px solid var(--line-soft);color:var(--muted)}
  .classroom-table tbody tr:last-child td{border-bottom:0}
  .classroom-table .cr-part{font-weight:600;color:var(--ink)}
  .classroom-notes{margin:14px 2px 0;padding-left:18px;display:flex;flex-direction:column;gap:7px}
  .classroom-notes li{font-size:13px;color:var(--muted);line-height:1.7}
```

- [ ] **Step 5: build 驗證**

Run: `npm run build`
Expected: 建置成功、無錯誤（`dist/summer/index.html` 產出）。

- [ ] **Step 6: 預覽驗證（桌機＋手機）**

`npm run preview` 後用預覽工具檢查 `/summer`：
- 表格出現在「暑訓行事曆」與「練習作業」之間。
- 8 列資料與原圖一致；表頭竹綠底白字；列間有柔線。
- 3 條注意事項在表格下方。
- 區段圓點：行事曆綠 → 教室金 → 練習作業朱紅。
- 手機（≤480px）：表格不破版、字清晰；「合奏（10:30–12:00）」列若過寬可水平捲動。
- 若手機上換行難看，微調 CSS（如把時間改為 `.cr-part` 內小字副行）後重驗。

- [ ] **Step 7: Commit（需先經使用者確認）**

先給使用者看 `git diff` 摘要並取得同意，再 commit。訊息格式：

```
K260701F [JimeiGuoyue] Add summer-training classroom table to the 暑訓專區 page.
```

（commit body 用英文條列說明：新增 `classrooms` 資料、渲染原生表格取代放原圖以利手機閱讀、練習作業區段色改朱紅維持輪替；附 `Release Note:` 三點。實際序號字母依當天前面已用到的順延。）

---

## Self-Review

**1. Spec coverage：**
- §2 呈現方式（原生表格）→ Step 2、4 ✓
- §2 落點（第 2 區）→ Step 2 插入位置 ✓
- §2 資料位置（summer.js `classrooms`）→ Step 1 ✓
- §2 分部標籤照原圖／老師名陳珮珊 → Step 1 資料 ✓
- §2 圓點色輪替 → Step 3 ✓
- §4 資料結構 → Step 1 ✓
- §5 顯示規格（表頭色／柔線／注意事項／手機捲動）→ Step 2、4、6 ✓
- §6 落點細節 → Step 2、3 ✓
- §7 驗收 → Step 5、6 ✓

**2. Placeholder scan：** 無 TBD/TODO；每個 code step 均含完整程式碼。commit 序號字母（F）為預估，Step 7 已註明依當天實際順延——非佔位，是明確指示。

**3. Type consistency：** `summer.classrooms` 的 `title`/`rows`（`part`/`room`/`teacher`）/`notes` 在 Step 1（定義）與 Step 2（渲染）用字一致 ✓；CSS class（`.classroom`/`.classroom-scroll`/`.classroom-table`/`.cr-part`/`.classroom-notes`）在 Step 2 標記與 Step 4 樣式一致 ✓。
