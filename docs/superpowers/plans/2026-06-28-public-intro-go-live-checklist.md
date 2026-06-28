# 對外公開版介紹 上線清單（一次性）

對應設計：`docs/superpowers/specs/2026-06-28-public-intro-site-design.md`。
目標：把 `intro-public/` 部署成一個**與內網不同網址**的公開站，放官方 LINE，且不曝光內網。

## 前置
- [ ] 確認最新圖片：`PDFTOCAIRO="C:/poppler/poppler-24.08.0/Library/bin/pdftocairo.exe" npm run build:intro`（兩處同步、注入 fallback；若已把 poppler 加進 PATH 則直接 `npm run build:intro`）。
- [ ] GitHub Desktop **Push**，讓 repo 含最新 `intro-public/`。

## 建立第二個 Cloudflare Pages 專案
- [ ] Cloudflare 儀表板 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
- [ ] 選同一個 GitHub repo（集美網站）。
- [ ] 設定：
  - Production branch：`main`
  - Framework preset：**None**
  - Build command：**留空**
  - Build output directory：**`intro-public`**
- [ ] **Save and Deploy** → 取得網址 `https://<專案名>.pages.dev`（例：`jimei-guoyue-intro.pages.dev`）。

## 修正連結預覽網址（讓 LINE 卡片正確）
- [ ] 若專案名 ≠ `jimei-guoyue-intro`，把 `intro-public/index.html` 內 4 處絕對網址（`og:url`、`og:image`、`twitter:image`，預設 `https://jimei-guoyue-intro.pages.dev/...`）改成你的實際 `*.pages.dev`。
- [ ] GitHub Desktop **Push**（Pages 會自動重新部署）。

## 放上官方 LINE
- [ ] 把 `https://<專案名>.pages.dev` 貼到官方 LINE。
- [ ] 用手機點開確認可翻頁、預覽卡片顯示封面＋標題。
- [ ] ⚠️ LINE 對網址預覽有快取：若卡片仍是舊的，網址後加沒貼過的參數（如 `?v=2`）或等快取過期。

## 驗證隔離
- [ ] 在公開站上**找不到也點不到**任何內網頁面（無導覽列、無內網網址）。
- [ ] 內網站維持不變：`jimei-guoyue-web.kuan-lin.workers.dev` 照舊，`/intro` 與「關於我們」入口卡仍在。

## 日後維護
- 換新版介紹：替換 `Reference/集美國小國樂介紹.pdf`（空白頁清單見 `scripts/build-intro-images.mjs` 的 `DROP`）→ `npm run build:intro` → Push。內網與公開站會各自自動更新。
