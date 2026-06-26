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
  sh.appendRow([new Date(), sanitizeCell(activity), sanitizeCell(job), sanitizeCell(name)]);
  return json({ ok: true });
}

// 防試算表公式注入：開頭為 = + - @ 時前置單引號，幹部開試算表時不會被當公式執行。
function sanitizeCell(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function readSheet(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const tz = ss.getSpreadsheetTimeZone();
  const headers = values[0].map((h) => String(h).trim());
  return values
    .slice(1)
    .map((row) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = cellToString(row[i], tz); });
      return o;
    })
    .filter((o) => Object.values(o).some((v) => v !== ''));
}

// 日期欄在試算表是「日期物件」，直接轉字串會變 "Mon Jun 29 2026..."；統一格式成 yyyy-MM-dd。
function cellToString(v, tz) {
  if (v == null) return '';
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return String(v).trim();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
