# 內網共用密碼閘（Password Gate）設計

日期：2026-07-02
狀態：已核可（2026-07-02，cookie 效期定案 30 天）

## 背景與目標

內網（https://jimei-guoyue-web.jmes-ntpc.workers.dev）目前唯一防護是「網址不公開」：無 robots.txt、無 noindex（查證目前尚未被 Google 收錄，但被收錄只是時間問題），站上有輕度個資（幹部全名、Footer 聯絡電話、活動支援看板的家長稱呼）。對外分享已走獨立 intro 站，本設計把內外分流補完：**內網加一道全團共用密碼的入口閘**，並補搜尋引擎 noindex 基線。

## 方案決策（評估摘要）

| 方案 | 結論 |
|---|---|
| A. Worker 共用密碼閘 | ✅ 採用——符合家長使用型態（LINE 群一組密碼、每月輸入一次）、幹部零名單維運、免費 |
| B. Cloudflare Access（email OTP） | 不採用——需維護 email 名單、免費 50 席可能不夠、對家長摩擦高；未來需要「知道誰能進／個別撤銷」再升級 |
| C. 純前端 JS 密碼簾 | 不採用——內容仍在原始碼，防不了爬蟲與 view-source |
| D. robots.txt＋noindex 基線 | ✅ 一併做（雙保險） |

## 架構

主站從「純靜態資產 Worker」升級為「Worker script＋靜態資產」：

- repo 根目錄加 `wrangler.jsonc`：`name: "jimei-guoyue-web"`（**必須沿用現有 Worker 名，網址才不變**）、`main: "worker/index.js"`、`assets: { directory: "./dist", binding: "ASSETS", run_worker_first: true }`
- 每個請求先進 Worker：cookie 驗證通過 → `env.ASSETS.fetch()` 回靜態資產；未通過 → 回密碼頁
- **Astro 站本體、資料流（Calendar API／published CSV／Apps Script）、公開 intro 站完全不動**

## 元件

| 元件 | 職責 |
|---|---|
| `worker/index.js` | 閘邏輯（~100 行）：驗 cookie、處理登入 POST、放行清單、回密碼頁 |
| `worker/auth.js` | 純函式：cookie 簽發與驗證（HMAC-SHA256＋過期時間）；vitest 測試 |
| 密碼頁 HTML（內嵌於 worker） | 品牌視覺（米色底、竹綠、logo）；文案「請輸入樂團密碼（見 LINE 群組公告）」；**head 帶完整 OG meta**（og:title「集美國小國樂團」＋og:image logo），LINE 分享卡片不變醜；帶 noindex |
| `public/robots.txt` | `Disallow: /`（基線 D） |
| `Layout.astro` | 加 `<meta name="robots" content="noindex">`（基線 D 雙保險） |
| Cloudflare secrets | `SITE_PASSWORD`（共用密碼）、`COOKIE_SECRET`（HMAC 金鑰）——有 Worker script 後 runtime secrets 解鎖可設 |

## 資料流

1. 未登入請求任何頁 → 401＋密碼頁（帶 OG meta、noindex）
2. 密碼頁表單 POST（如 `POST /__gate/login`，帶原始目標路徑）→ 密碼正確 → Set-Cookie（HttpOnly、Secure、SameSite=Lax、**Max-Age 30 天**（使用者定案：每月輸入一次；若日後要調整頻率，改 worker 內一個常數即可）、Path=/；值＝過期時間戳＋HMAC-SHA256 簽章）→ 302 導回原目標（深層連結不迷路）
3. 密碼錯誤 → 密碼頁顯示「密碼不正確」
4. 已登入 → 直接回靜態資產，30 天內免再輸入
5. **放行清單**（免登入）：`/logo.png`（LINE 預覽要抓 og:image）、`/favicon.png`、`/favicon.ico`、`/robots.txt`；其他一律擋——特別是 JS bundle（內嵌公告 CSV 與 Apps Script 網址）

## 錯誤處理

- Worker 內部例外 → fail-closed（回密碼頁，不裸奔）
- 不做 rate limit（每次錯誤都要重送表單，小站自然節流）

## 保護邊界（誠實聲明）

閘保護的是**網站入口**。三個資料來源本身（公告 published CSV、活動支援 Apps Script `/exec`、公開 Google 日曆）仍是「知道網址就能讀」的公開端點——但這些網址只嵌在站內 JS，過閘前拿不到，等於順帶收起。已外流的網址不會因加閘而收回。若未來要連資料端點都上鎖，需改走 Worker 代理（本次不做）。

## 維運（幹部視角）

- **換密碼**：Cloudflare dashboard 改 `SITE_PASSWORD` → LINE 群公告新密碼。已登入者最多 30 天內仍有效，之後自然改用新密碼
- **全員強制重新驗證**（密碼外流止血）：連 `COOKIE_SECRET` 一起換 → 所有裝置立即登出
- 建議每學年換一次密碼（處理離團家長仍知密碼；30 天效期下換密碼一個月內全面生效）

## 一次性上線設定（Cloudflare dashboard）

1. 主站 Workers Builds 的 Deploy command 改為 `npx wrangler deploy`（與 intro 站同模式；Build command 維持 `npm run build`）
2. Settings → Variables and secrets（runtime）新增 `SITE_PASSWORD`、`COOKIE_SECRET` 兩個 secret
3. Push 觸發重建 → 驗證

## 測試

- vitest：`worker/auth.js` 簽章／驗證／過期純函式（Node 18+ 有 global `crypto.subtle`）
- 手動驗證清單：
  - 未登入 → 密碼頁；錯密碼 → 錯誤提示；對密碼 → 進站且深層連結導向正確
  - `/logo.png`、`/robots.txt` 免登入可取
  - LINE 分享預覽卡片正常（og:image 可抓）
  - 首頁「近期行程」正常（網址不變，Calendar API referrer 白名單不受影響）
  - 本機 `npm run dev` 照常（不經 Worker）；要測閘用 `npm run build` 後 `npx wrangler dev`

## 明確不做（YAGNI）

- 資料端點代理、個人帳號／email 名單（未來再升級 Cloudflare Access）、登入 rate limiting、密碼強度規則、多組密碼

## 已定案參數

- cookie 效期：**30 天**（使用者定案：每月輸入一次）
- 密碼值：由會長／幹部決定，上線設定時填入 `SITE_PASSWORD` secret（不寫進 repo）
