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
