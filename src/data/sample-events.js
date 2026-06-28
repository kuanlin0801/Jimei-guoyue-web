import { calendars } from './calendars.js';
import { normalize } from '../lib/events.js';

// 開發／未設 API 金鑰時的範例行程：依「現在」往後推算，恆為未來。
// 依日曆「名稱」對應 color/name（不綁陣列順序，增刪日曆才不會錯位）；
// 走 normalize() 產生與真實資料相同的形狀，可直接餵給 toUpcoming / takeNext。

function taipeiDateStr(now, offsetDays) {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d); // → "2026-07-02"
}

export function sampleEvents(now) {
  const d = (off) => taipeiDateStr(now, off);
  const cal = (name) => calendars.find((c) => c.name === name);
  const raw = [
    ['集美國樂團', '常態團練', { dateTime: `${d(3)}T09:00:00+08:00` }],
    ['國樂團個別課', '小提琴個別課', { dateTime: `${d(5)}T16:00:00+08:00` }],
    ['集美國樂團暑訓', '暑期密集訓練（第一週）', { date: d(7) }],
    ['集美古箏/提琴', '古箏分部課', { dateTime: `${d(10)}T14:00:00+08:00` }],
    ['集美國樂團', '期末成果彩排', { dateTime: `${d(17)}T09:00:00+08:00` }],
    ['集美國樂團暑訓', '暑訓成果發表會', { dateTime: `${d(24)}T15:00:00+08:00` }],
  ];
  return raw.map(([name, summary, start]) => normalize({ summary, start }, cal(name)));
}
