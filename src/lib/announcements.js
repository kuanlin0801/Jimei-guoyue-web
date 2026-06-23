// 解析「Google 試算表發布的 CSV」公告。欄位：日期, 標題, 內容
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function parseAnnouncementsCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  const items = [];
  for (let i = 1; i < lines.length; i++) { // 跳過標題列
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = splitCsvLine(line);
    const date = (cols[0] ?? '').trim();
    const title = (cols[1] ?? '').trim();
    const body = (cols[2] ?? '').trim();
    if (!date && !title && !body) continue;
    items.push({ date, title, body });
  }
  return items;
}

export async function fetchAnnouncements(csvUrl, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(csvUrl);
  if (!res.ok) throw new Error(`公告載入失敗：${res.status}`);
  const text = await res.text();
  return parseAnnouncementsCsv(text);
}
