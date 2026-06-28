// 把社團介紹 PDF 逐頁轉成整頁圖＋縮圖，輸出到 public/intro/
// 需要 Poppler 的 pdftocairo；若不在 PATH，設環境變數 PDFTOCAIRO 指向執行檔
// （Windows 例：set PDFTOCAIRO=C:/poppler/.../bin/pdftocairo.exe）
//
// 注意：以 cwd=專案根目錄＋「相對」輸出路徑呼叫 pdftocairo。
// 專案路徑含中文（集美國樂網頁設計），而 pdftocairo 在 Windows 是用 ANSI fopen 寫檔，
// 若給「含中文的絕對輸出路徑」會「Error opening output file」；相對 ASCII 路徑經由 cwd
// 解析則正常。
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.PDFTOCAIRO || 'pdftocairo';
const pdfRel = 'Reference/集美國小國樂介紹.pdf';
const outRel = 'public/intro';
const outDir = join(root, outRel);

// 來源 PDF 中的空白頁（1-based）；產圖時略過、其餘頁重新編號為連續 1..N。
// 換新版介紹時若無空白頁，改成空集合 new Set() 即可。
const DROP = new Set([13, 15]);

const pad = (n) => String(n).padStart(2, '0');
const run = (args) => execFileSync(bin, args, { cwd: root, stdio: 'inherit' });

mkdirSync(outDir, { recursive: true });

// 清掉舊輸出，避免重新編號後殘留多餘頁（如舊的 page-24/25）或上次的暫存檔
for (const f of readdirSync(outDir)) {
  if (/^(page|thumb|_raw-page|_raw-thumb)-\d+\.jpg$/.test(f)) rmSync(join(outDir, f));
}

// 先把每一頁轉到暫存前綴（_raw-page-NN / _raw-thumb-NN）
run(['-jpeg', '-scale-to-x', '1800', '-scale-to-y', '-1', '-jpegopt', 'quality=85', pdfRel, `${outRel}/_raw-page`]);
run(['-jpeg', '-scale-to-x', '320', '-scale-to-y', '-1', '-jpegopt', 'quality=80', pdfRel, `${outRel}/_raw-thumb`]);

// 依來源頁序略過 DROP，其餘搬成連續編號的 page-NN / thumb-NN
const rawPages = readdirSync(outDir).filter((f) => /^_raw-page-\d+\.jpg$/.test(f)).sort();
let out = 0;
for (const f of rawPages) {
  const n = f.match(/^_raw-page-(\d+)\.jpg$/)[1];
  const srcPage = parseInt(n, 10);
  if (DROP.has(srcPage)) {
    rmSync(join(outDir, `_raw-page-${n}.jpg`));
    rmSync(join(outDir, `_raw-thumb-${n}.jpg`));
    continue;
  }
  out += 1;
  renameSync(join(outDir, `_raw-page-${n}.jpg`), join(outDir, `page-${pad(out)}.jpg`));
  renameSync(join(outDir, `_raw-thumb-${n}.jpg`), join(outDir, `thumb-${pad(out)}.jpg`));
}

console.log(`Generated ${out} pages + thumbs in public/intro/ (dropped blank source pages: ${[...DROP].join(', ') || 'none'})`);

// ── 同步到對外公開站 intro-public/（與內網不同網域，供官方 LINE）──
const pubDir = join(root, 'intro-public');
mkdirSync(pubDir, { recursive: true });

// 清掉舊圖，避免換版後殘留多餘頁
for (const f of readdirSync(pubDir)) {
  if (/^(page|thumb)-\d+\.jpg$/.test(f)) rmSync(join(pubDir, f));
}

// 複製整頁圖＋縮圖
for (const f of readdirSync(outDir)) {
  if (/^(page|thumb)-\d+\.jpg$/.test(f)) copyFileSync(join(outDir, f), join(pubDir, f));
}

// 複製 page-flip 函式庫（module build，自站 host）
copyFileSync(
  join(root, 'node_modules', 'page-flip', 'dist', 'js', 'page-flip.module.js'),
  join(pubDir, 'page-flip.module.js'),
);

// 把整頁圖 <img> 清單注入 index.html 的 fallback markers 之間（no-JS 退路＋前端資料來源）
const finalPages = readdirSync(pubDir).filter((f) => /^page-\d+\.jpg$/.test(f)).sort();
const fallbackHtml = finalPages
  .map((f, i) => `      <img src="./${f}" alt="社團介紹 第 ${i + 1} 頁" loading="lazy" />`)
  .join('\n');
const htmlPath = join(pubDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8').replace(
  /<!--FALLBACK_START-->[\s\S]*?<!--FALLBACK_END-->/,
  `<!--FALLBACK_START-->\n${fallbackHtml}\n      <!--FALLBACK_END-->`,
);
writeFileSync(htmlPath, html);

console.log(`Synced ${finalPages.length} pages to intro-public/ and injected fallback list.`);
