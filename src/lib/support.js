import { isSafeHref } from './csv.js';

// 多選／指定欄以逗號、頓號分隔。
function splitItems(cell) {
  return String(cell ?? '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
}

// 需求人數 → 正整數，否則回 fallback（接龍空白為 null＝無上限；分工預設 1）。
function toTarget(v, fallback) {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeStatus(v) {
  const s = String(v ?? '').trim();
  return s === '結束' || s === '額滿' ? s : '開放';
}

// 日期正規化成可比較的 YYYYMMDD（容錯 2026/8/1、2026-08-22 等）。
function dateKey(s) {
  const p = String(s ?? '').match(/\d+/g);
  if (!p || p.length < 3) return '';
  const [y, m, d] = p;
  return y.padStart(4, '0') + m.padStart(2, '0') + d.padStart(2, '0');
}

function makeJob({ label, target, assigned, claimers, activityOpen }) {
  // 同一稱呼在同一工作只算一次（試算表保留原始列，看板去重呈現與計數）。
  const names = [...new Set([...assigned, ...claimers])];
  const signed = names.length;
  const assignedFixed = assigned.length > 0;
  const enough = assignedFixed || (target != null && signed >= target);
  const short = target != null ? Math.max(0, target - signed) : 0;
  const canClaim = !assignedFixed && activityOpen && !enough;
  return { label, target, assigned, claimers, names, signed, short, enough, assignedFixed, canClaim };
}

// 未結束的依日期升冪在前，結束的依日期降冪殿後（同日期維持輸入順序，sort 穩定）。
function orderActivities(list) {
  const live = list.filter((a) => !a.ended);
  const ended = list.filter((a) => a.ended);
  live.sort((a, b) => (dateKey(a.date) < dateKey(b.date) ? -1 : dateKey(a.date) > dateKey(b.date) ? 1 : 0));
  ended.sort((a, b) => (dateKey(a.date) < dateKey(b.date) ? 1 : dateKey(a.date) > dateKey(b.date) ? -1 : 0));
  return [...live, ...ended];
}

// 把「活動／工作／報名」三組資料列組成兩型看板 view model。
export function buildSupportView({ activities = [], jobs = [], responses = [] } = {}) {
  const jobsByActivity = new Map();
  for (const j of jobs) {
    const key = String(j['活動'] ?? '').trim();
    if (!jobsByActivity.has(key)) jobsByActivity.set(key, []);
    jobsByActivity.get(key).push(j);
  }

  const result = activities.map((act) => {
    const name = String(act['名稱'] ?? '').trim();
    const type = String(act['類型'] ?? '').trim() === '分工' ? '分工' : '接龍';
    const status = normalizeStatus(act['狀態']);
    const open = status === '開放';
    const acResponses = responses.filter((r) => String(r['活動'] ?? '').trim() === name);

    let jobsOut;
    if (type === '分工') {
      jobsOut = (jobsByActivity.get(name) || []).map((def) => {
        const label = String(def['工作'] ?? '').trim();
        const claimers = acResponses
          .filter((r) => String(r['工作'] ?? '').trim() === label)
          .map((r) => String(r['稱呼'] ?? '').trim())
          .filter(Boolean);
        return makeJob({ label, target: toTarget(def['需求人數'], 1), assigned: splitItems(def['指定']), claimers, activityOpen: open });
      });
    } else {
      const claimers = acResponses.map((r) => String(r['稱呼'] ?? '').trim()).filter(Boolean);
      jobsOut = [makeJob({ label: '', target: toTarget(act['需求人數'], null), assigned: [], claimers, activityOpen: open })];
    }

    const lineRaw = String(act['LINE連結'] ?? '').trim();
    return {
      name,
      date: String(act['日期'] ?? '').trim(),
      time: String(act['時間'] ?? '').trim(),
      type,
      status,
      ended: status === '結束',
      full: status === '額滿',
      open,
      note: String(act['說明'] ?? '').trim(),
      lineUrl: isSafeHref(lineRaw) ? lineRaw : '',
      jobs: jobsOut,
      total: new Set(jobsOut.flatMap((j) => j.names)).size,
    };
  });

  return orderActivities(result);
}
