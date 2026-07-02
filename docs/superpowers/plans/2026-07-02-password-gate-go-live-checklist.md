# 密碼閘上線操作清單

前置：`main` 已含密碼閘程式（wrangler.jsonc＋worker/）。整個流程約 10 分鐘；
步驟 2 push 之後到步驟 3 設好 secrets 之前，全站會顯示密碼頁且任何密碼都進不去
（fail-closed 保護），建議選離峰時段一次做完。併入 main 後的下一次 push 就會讓閘上線，
請併入後盡快接著完成步驟 1–3。

## 0. 事前準備
- [ ] 會長／幹部決定要公告給家長的「樂團密碼」
- [ ] 產生 COOKIE_SECRET 隨機亂碼（本機執行）：
      `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
      記下輸出（家長不會看到它，只是簽章用）

## 1. 改部署指令（一次性）
- [ ] Cloudflare dashboard → Workers & Pages → **jimei-guoyue-web** → Settings → Build
- [ ] Deploy command 改為：`npx wrangler deploy`（Build command 維持 `npm run build`）

## 2. 部署
- [ ] GitHub Desktop push（或確認 main 已含本功能）→ 等 Cloudflare build 完成
- [ ] 開 https://jimei-guoyue-web.jmes-ntpc.workers.dev → 應看到密碼頁（此刻輸什麼都進不去，正常）

## 3. 設定 secrets（此時 runtime 區已解鎖）
- [ ] 同 Worker → Settings → Variables and secrets（**runtime** 區，不是 Build 區）
- [ ] 新增 `COOKIE_SECRET`（Type: Secret）＝步驟 0 產生的亂碼
      （先設簽章金鑰：這段空窗任何密碼都會被乾淨拒絕，不會出現錯誤頁）
- [ ] 新增 `SITE_PASSWORD`（Type: Secret）＝要公告的樂團密碼
- [ ] 儲存後即刻生效，**不需**重新部署

## 4. 驗證
- [ ] 無痕視窗開站 → 密碼頁 → 輸錯 → 「密碼不正確」；輸對 → 進站
- [ ] 進站後首頁「近期行程」正常載入（Calendar API 不受影響）
- [ ] 公告頁、文件頁、活動支援頁資料正常
- [ ] 關掉無痕再開一般視窗 → 已登入者 30 天內不再被問
- [ ] 手機 LINE：把網址貼到與自己的聊天室 → 預覽小卡仍是團徽＋「集美國小國樂團」
      （若卡片是舊快取，網址加 `?v=4` 再貼）
- [ ] 手機 LINE 點連結 → 密碼頁 → 輸入 → 進站
- [ ] 對外介紹站 https://jimei-guoyue-intro.jmes-ntpc.workers.dev 仍可直接開（不受影響）

## 5. 公告
- [ ] LINE 群公告網站密碼與「約每月會再問一次」的說明

## 回滾（若出問題）
- [ ] revert 密碼閘的 commits → push（wrangler.jsonc 消失後 `npx wrangler deploy` 會失敗，
      需同時把 Deploy command 清回原值）；或快速止血：wrangler.jsonc 移除
      `"main"`、`"run_worker_first"` 與 `"binding"` **三**行（保留
      `"assets": { "directory": "./dist" }`）→ push，即回到無閘的純靜態站

## 日常維運
- 換密碼（建議每學年）：dashboard 改 `SITE_PASSWORD` → LINE 公告；已登入者最多 30 天後改用新密碼
- 緊急全員登出（密碼外流）：連 `COOKIE_SECRET` 一起換新亂碼 → 所有裝置立即要求重新輸入
