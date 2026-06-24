import { parseCsvRows } from './csv.js';

// 多選項目以逗號／頓號分隔（Google 表單核取方塊匯出格式）。
function splitItems(cell) {
  return String(cell ?? '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 彙整活動支援報名看板資料。
// 回傳 { total, names, byCategory:[{label,target,signed,short,enough}] }
// 「能否到場」為「不可」者不計入。
export function summarizeSupport(csvText, needs = [], opts = {}) {
  const {
    nameHeader = '顯示稱呼',
    itemsHeader = '可幫忙項目',
    attendHeader = '能否到場',
  } = opts;
  const rows = parseCsvRows(csvText);
  const helpers = rows.filter((r) => (r[attendHeader] ?? '') !== '不可');
  const names = helpers.map((r) => (r[nameHeader] ?? '').trim()).filter(Boolean);
  const byCategory = needs.map(({ label, target }) => {
    const signed = helpers.filter((r) => splitItems(r[itemsHeader]).includes(label)).length;
    return { label, target, signed, short: Math.max(0, target - signed), enough: signed >= target };
  });
  return { total: helpers.length, names, byCategory };
}
