// 純邏輯：把 Google Calendar API 回傳的活動正規化、合併、排序、取數、格式化。
// 不碰 DOM、不讀 new Date()——now 由呼叫端注入，方便測試。

const TZ = 'Asia/Taipei';
const WEEKDAYS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 取得某個瞬間「在台北」的年月日。
function taipeiYMD(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')) };
}

// 台北當天 00:00 的瞬間。
function startOfTaipeiDay(date) {
  const { y, m, d } = taipeiYMD(date);
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00+08:00`);
}

export function parseStart(item) {
  const s = item.start ?? {};
  if (s.dateTime) return { at: new Date(s.dateTime), isAllDay: false };
  return { at: new Date(`${s.date}T00:00:00+08:00`), isAllDay: true };
}

// 幹部在日曆活動標題加標記＝重要活動。文件只教 ★，其餘為容錯（打成別的也不會失效）。
export const FEATURED_MARKERS = ['★', '⭐', '【重要】'];

export function isFeatured(title) {
  const s = String(title ?? '');
  return FEATURED_MARKERS.some((m) => s.includes(m));
}

// 標記只存在於 Google 端，畫面上一律顯示乾淨標題。
export function stripMarker(title) {
  let s = String(title ?? '');
  for (const m of FEATURED_MARKERS) s = s.split(m).join('');
  return s.trim();
}

export function normalize(item, calMeta) {
  const { at, isAllDay } = parseStart(item);
  const raw = (item.summary ?? '').trim();
  const title = stripMarker(raw) || '(無標題)';
  return { title, at, isAllDay, color: calMeta.color, calName: calMeta.name, featured: isFeatured(raw) };
}

// 全天活動當天仍顯示；計時活動須晚於此刻才算未來。
function isUpcoming(ev, now) {
  return ev.isAllDay ? ev.at >= startOfTaipeiDay(now) : ev.at >= now;
}

export function toUpcoming(events, now) {
  return events.filter((ev) => isUpcoming(ev, now)).sort((a, b) => a.at - b.at);
}

export function takeNext(events, n) {
  return events.slice(0, n);
}

// events 須為 toUpcoming 排序後的結果；時間最近的重要活動排最前。
// 週期性活動經 singleEvents=true 展開為多筆同標題場次，此處依標題去重、只留最早一筆，避免同一場重複活動佔滿卡片。
export function pickFeatured(events, limit = 3) {
  const seen = new Set();
  const deduped = [];
  for (const ev of events) {
    if (!ev.featured || seen.has(ev.title)) continue;
    seen.add(ev.title);
    deduped.push(ev);
  }
  return deduped.slice(0, limit);
}

export function formatMonthDay(at) {
  const { m, d } = taipeiYMD(at);
  return `${m}/${d}`;
}

export function formatWeekday(at) {
  const en = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(at);
  return WEEKDAYS_ZH[EN_WEEKDAYS.indexOf(en)];
}

export function formatTime(ev) {
  if (ev.isAllDay) return '全天';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(ev.at);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('hour')}:${get('minute')}`;
}

// 以「台北當日 00:00」相減，同一場活動不會因為現在幾點而變天數。
export function daysUntil(at, now) {
  return Math.round((startOfTaipeiDay(at) - startOfTaipeiDay(now)) / 86400000);
}

export function formatCountdown(days) {
  if (days <= 0) return '就是今天';
  if (days === 1) return '明天';
  return `還有 ${days} 天`;
}

export async function fetchCalendarEvents(calendar, { apiKey, now, maxResults = 50, fetchImpl = fetch } = {}) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`;
  const qs = new URLSearchParams({
    key: apiKey,
    timeMin: now.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });
  const res = await fetchImpl(`${base}?${qs}`);
  if (!res.ok) throw new Error(`行事曆載入失敗：${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map((item) => normalize(item, calendar));
}

// 容錯：單一日曆失敗（如未設公開）只少那一個，仍回傳其餘日曆的活動；全部失敗才丟出。
// 回傳「完整」的未來活動排序清單——首頁要用同一份資料同時餵近期行程與重要活動倒數，取數交給呼叫端。
export async function fetchUpcoming(calendars, { apiKey, now, fetchImpl = fetch } = {}) {
  const results = await Promise.allSettled(
    calendars.map((c) => fetchCalendarEvents(c, { apiKey, now, fetchImpl }))
  );
  const ok = results.filter((r) => r.status === 'fulfilled');
  if (ok.length === 0) throw results[0]?.reason ?? new Error('行事曆載入失敗');
  const events = ok.flatMap((r) => r.value);
  return toUpcoming(events, now);
}
