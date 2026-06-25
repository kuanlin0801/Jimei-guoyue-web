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

export function normalize(item, calMeta) {
  const { at, isAllDay } = parseStart(item);
  const title = (item.summary ?? '').trim() || '(無標題)';
  return { title, at, isAllDay, color: calMeta.color, calName: calMeta.name };
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

export async function fetchCalendarEvents(calendar, { apiKey, now, maxResults = 10, fetchImpl = fetch } = {}) {
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

export async function fetchUpcoming(calendars, { apiKey, now, count = 5, fetchImpl = fetch } = {}) {
  const batches = await Promise.all(
    calendars.map((c) => fetchCalendarEvents(c, { apiKey, now, fetchImpl }))
  );
  return takeNext(toUpcoming(batches.flat(), now), count);
}
