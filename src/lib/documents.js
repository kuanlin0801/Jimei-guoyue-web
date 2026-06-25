import { splitCsvLine, isSafeHref } from './csv.js';
import { isPinnedMark, pinnedFirst } from './announcements.js';

const TYPE_BY_EXT = {
  pdf: 'PDF',
  jpg: '圖片', jpeg: '圖片', png: '圖片', gif: '圖片', webp: '圖片',
  doc: 'Word', docx: 'Word',
  xls: 'Excel', xlsx: 'Excel',
};

// 由副檔名推文件類型標籤；未知或無副檔名 → 「檔案」。
export function inferType(name) {
  const m = String(name ?? '').toLowerCase().match(/\.([a-z0-9]+)\s*$/);
  return (m && TYPE_BY_EXT[m[1]]) || '檔案';
}

// 解析文件試算表 CSV（日期,名稱,連結,類型,備註,置頂），略過空白行；不安全連結的 url 清空。
export function parseDocumentsCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  const items = [];
  for (let i = 1; i < lines.length; i++) { // 跳過標題列
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = splitCsvLine(line);
    const date = (cols[0] ?? '').trim();
    const name = (cols[1] ?? '').trim();
    const url = (cols[2] ?? '').trim();
    const type = (cols[3] ?? '').trim();
    const note = (cols[4] ?? '').trim();
    if (!date && !name && !url) continue;
    items.push({
      date, name,
      url: isSafeHref(url) ? url : '',
      type, note,
      pinned: isPinnedMark(cols[5]),
      source: 'document',
    });
  }
  return items;
}

// 公告（含 attachment）→ 文件項；無附件回 null。
export function announcementToDoc(a) {
  if (!a || !a.attachment) return null;
  return {
    date: a.date,
    name: a.attachment.name,
    url: a.attachment.url,
    type: inferType(a.attachment.name),
    note: `來自「${a.title}」公告`,
    pinned: a.pinned,
    source: 'announcement',
  };
}

// 把日期正規化成可比較的 YYYYMMDD（容錯 2026/06/25、2026-6-5、2026.6.5 等格式）。
function dateKey(s) {
  const parts = String(s ?? '').match(/\d+/g);
  if (!parts || parts.length < 3) return '';
  const [y, m, d] = parts;
  return y.padStart(4, '0') + m.padStart(2, '0') + d.padStart(2, '0');
}

// 依日期降冪、相同日期維持輸入順序（穩定）；日期格式正規化後再比較。
function byDateDesc(items) {
  return items
    .map((it, i) => [it, dateKey(it.date), i])
    .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : a[2] - b[2]))
    .map(([it]) => it);
}

// 置頂最前、其餘依日期新到舊。
export function sortDocuments(items) {
  return pinnedFirst(byDateDesc(items));
}

// 合併常設文件與公告附件，回傳已排序的統一文件清單。
export function buildDocumentList(announcements, documents) {
  const fromAnn = announcements.map(announcementToDoc).filter(Boolean);
  return sortDocuments([...documents, ...fromAnn]);
}
