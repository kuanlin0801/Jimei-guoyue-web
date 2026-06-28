// 把社團介紹 PDF 逐頁轉成整頁圖＋縮圖，輸出到 public/intro/
// 需要 Poppler 的 pdftocairo；若不在 PATH，設環境變數 PDFTOCAIRO 指向執行檔
// （Windows 例：set PDFTOCAIRO=C:/poppler/.../bin/pdftocairo.exe）
//
// 注意：以 cwd=專案根目錄＋「相對」輸出路徑呼叫 pdftocairo。
// 專案路徑含中文（集美國樂網頁設計），而 pdftocairo 在 Windows 是用 ANSI fopen 寫檔，
// 若給「含中文的絕對輸出路徑」會「Error opening output file」；相對 ASCII 路徑經由 cwd
// 解析則正常。
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.PDFTOCAIRO || 'pdftocairo';
const pdfRel = 'Reference/集美國小國樂介紹.pdf';
const outRel = 'public/intro';
const run = (args) => execFileSync(bin, args, { cwd: root, stdio: 'inherit' });

mkdirSync(join(root, outRel), { recursive: true });

// 整頁圖：約 1800px 寬、JPEG q85 → page-NN.jpg
run(['-jpeg', '-scale-to-x', '1800', '-scale-to-y', '-1', '-jpegopt', 'quality=85', pdfRel, `${outRel}/page`]);

// 縮圖：約 320px 寬、JPEG q80 → thumb-NN.jpg
run(['-jpeg', '-scale-to-x', '320', '-scale-to-y', '-1', '-jpegopt', 'quality=80', pdfRel, `${outRel}/thumb`]);

const files = readdirSync(join(root, outRel));
const pageCount = files.filter((f) => /^page-\d+\.jpg$/.test(f)).length;
const thumbCount = files.filter((f) => /^thumb-\d+\.jpg$/.test(f)).length;
console.log(`Generated ${pageCount} pages + ${thumbCount} thumbs in public/intro/`);
