import { describe, it, expect } from 'vitest';
import {
  parseStart,
  normalize,
  isFeatured,
  stripMarker,
  toUpcoming,
  takeNext,
  pickFeatured,
  formatMonthDay,
  formatWeekday,
  formatTime,
  daysUntil,
  formatCountdown,
  fetchCalendarEvents,
  fetchUpcoming,
} from './events.js';

const NOW = new Date('2026-06-25T12:00:00+08:00'); // 週四中午（台北）

describe('parseStart', () => {
  it('parses a timed event start to the correct instant', () => {
    const r = parseStart({ start: { dateTime: '2026-07-05T14:00:00+08:00' } });
    expect(r.isAllDay).toBe(false);
    expect(r.at.toISOString()).toBe('2026-07-05T06:00:00.000Z');
  });
  it('parses an all-day event start as Taipei midnight', () => {
    const r = parseStart({ start: { date: '2026-07-02' } });
    expect(r.isAllDay).toBe(true);
    expect(r.at.toISOString()).toBe('2026-07-01T16:00:00.000Z');
  });
});

describe('normalize', () => {
  it('normalizes the summary and attaches calendar meta', () => {
    const ev = normalize(
      { summary: '常態團練', start: { dateTime: '2026-07-05T14:00:00+08:00' } },
      { name: '集美國樂團', color: '#e4c441' }
    );
    expect(ev).toMatchObject({ title: '常態團練', isAllDay: false, color: '#e4c441', calName: '集美國樂團' });
  });
  it('falls back to a placeholder title when summary is missing', () => {
    const ev = normalize({ start: { date: '2026-07-02' } }, { name: 'x', color: '#000' });
    expect(ev.title).toBe('(無標題)');
  });
});

describe('isFeatured', () => {
  it('recognises the documented ★ marker', () => {
    expect(isFeatured('★新生體驗招生活動')).toBe(true);
  });
  it('also accepts the tolerated ⭐ and 【重要】 variants', () => {
    expect(isFeatured('⭐校慶音樂會')).toBe(true);
    expect(isFeatured('【重要】校慶音樂會')).toBe(true);
  });
  it('accepts the marker typed at the end of the title', () => {
    expect(isFeatured('校慶音樂會★')).toBe(true);
  });
  it('is false for a plain title, empty string, and missing input', () => {
    expect(isFeatured('常態團練')).toBe(false);
    expect(isFeatured('')).toBe(false);
    expect(isFeatured(undefined)).toBe(false);
  });
});

describe('stripMarker', () => {
  it('removes the marker and the whitespace it leaves behind', () => {
    expect(stripMarker('★新生體驗招生活動')).toBe('新生體驗招生活動');
    expect(stripMarker('★ 新生體驗招生活動')).toBe('新生體驗招生活動');
    expect(stripMarker('【重要】校慶音樂會')).toBe('校慶音樂會');
    expect(stripMarker('校慶音樂會★')).toBe('校慶音樂會');
  });
  it('leaves an unmarked title untouched', () => {
    expect(stripMarker('常態團練')).toBe('常態團練');
  });
  it('returns an empty string when the title is only a marker', () => {
    expect(stripMarker('★')).toBe('');
  });
});

describe('normalize (featured flag)', () => {
  const cal = { name: '全團常態課與展演', color: '#e4c441' };
  it('strips the marker from the title and flags the event as featured', () => {
    const ev = normalize({ summary: '★新生體驗招生活動', start: { date: '2026-08-22' } }, cal);
    expect(ev.title).toBe('新生體驗招生活動');
    expect(ev.featured).toBe(true);
  });
  it('flags a plain event as not featured', () => {
    const ev = normalize({ summary: '常態團練', start: { date: '2026-08-22' } }, cal);
    expect(ev.title).toBe('常態團練');
    expect(ev.featured).toBe(false);
  });
  it('falls back to the placeholder title when only a marker was typed', () => {
    const ev = normalize({ summary: '★', start: { date: '2026-08-22' } }, cal);
    expect(ev.title).toBe('(無標題)');
    expect(ev.featured).toBe(true);
  });
});

describe('toUpcoming', () => {
  const make = (at, isAllDay, title) => ({ at: new Date(at), isAllDay, title });
  it('keeps today all-day and future events, drops past, sorted ascending', () => {
    const events = [
      make('2026-07-05T14:00:00+08:00', false, 'future-timed'),
      make('2026-06-25T09:00:00+08:00', false, 'past-timed-today'),
      make('2026-06-25T00:00:00+08:00', true, 'today-allday'),
      make('2026-06-24T00:00:00+08:00', true, 'yesterday-allday'),
    ];
    expect(toUpcoming(events, NOW).map((e) => e.title)).toEqual(['today-allday', 'future-timed']);
  });
  it('does not mutate the input array', () => {
    const events = [make('2026-07-01T00:00:00+08:00', true, 'a')];
    const copy = [...events];
    toUpcoming(events, NOW);
    expect(events).toEqual(copy);
  });
});

describe('takeNext', () => {
  it('takes the first n', () => {
    expect(takeNext([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
  });
  it('returns all when fewer than n', () => {
    expect(takeNext([1, 2], 5)).toEqual([1, 2]);
  });
});

describe('pickFeatured', () => {
  const ev = (title, featured, at) => ({ title, featured, at: new Date(at) });
  const list = [
    ev('常態團練', false, '2026-07-28T09:00:00+08:00'),
    ev('新生體驗招生活動', true, '2026-08-22T00:00:00+08:00'),
    ev('胡琴課', false, '2026-08-25T09:00:00+08:00'),
    ev('校慶音樂會', true, '2026-09-13T00:00:00+08:00'),
    ev('全國賽', true, '2026-10-05T00:00:00+08:00'),
    ev('冬令營', true, '2027-01-20T00:00:00+08:00'),
  ];
  it('keeps only featured events, in the order given, capped at 3 by default', () => {
    expect(pickFeatured(list).map((e) => e.title)).toEqual(['新生體驗招生活動', '校慶音樂會', '全國賽']);
  });
  it('returns an empty array when nothing is featured', () => {
    expect(pickFeatured([ev('常態團練', false, '2026-07-28T09:00:00+08:00')])).toEqual([]);
  });
  it('honours an explicit limit', () => {
    expect(pickFeatured(list, 1).map((e) => e.title)).toEqual(['新生體驗招生活動']);
  });
  it('returns an empty array for an empty list', () => {
    expect(pickFeatured([])).toEqual([]);
  });
  it('de-duplicates a recurring event by title, keeping only its earliest occurrence', () => {
    // singleEvents=true 讓周期性活動（如暑期集訓）展開成多筆同標題場次，三筆都會被標記 featured。
    const recurring = [
      ev('暑期集訓', true, '2026-07-30T00:00:00+08:00'),
      ev('暑期集訓', true, '2026-07-31T00:00:00+08:00'),
      ev('暑期集訓', true, '2026-08-01T00:00:00+08:00'),
      ev('校慶音樂會', true, '2026-09-13T00:00:00+08:00'),
      ev('全國賽', true, '2026-10-05T00:00:00+08:00'),
    ];
    const result = pickFeatured(recurring);
    expect(result.map((e) => e.title)).toEqual(['暑期集訓', '校慶音樂會', '全國賽']);
    expect(result[0].at).toEqual(recurring[0].at);
  });
});

describe('formatting (Asia/Taipei)', () => {
  it('formats month/day', () => {
    expect(formatMonthDay(new Date('2026-07-02T00:00:00+08:00'))).toBe('7/2');
  });
  it('formats weekday in Chinese', () => {
    expect(formatWeekday(new Date('2026-07-02T00:00:00+08:00'))).toBe('週四');
  });
  it('formats timed events as HH:mm and all-day as 全天', () => {
    expect(formatTime({ at: new Date('2026-07-05T14:00:00+08:00'), isAllDay: false })).toBe('14:00');
    expect(formatTime({ isAllDay: true })).toBe('全天');
  });
  it('formats near-midnight times without timezone drift', () => {
    expect(formatTime({ at: new Date('2026-07-05T00:30:00+08:00'), isAllDay: false })).toBe('00:30');
    expect(formatMonthDay(new Date('2026-07-05T00:30:00+08:00'))).toBe('7/5');
  });
});

describe('daysUntil (Asia/Taipei day boundary)', () => {
  it('counts today as 0 no matter the time of day', () => {
    expect(daysUntil(new Date('2026-07-27T23:30:00+08:00'), new Date('2026-07-27T00:30:00+08:00'))).toBe(0);
  });
  it('counts tomorrow as 1 even late tonight', () => {
    expect(daysUntil(new Date('2026-07-28T08:00:00+08:00'), new Date('2026-07-27T23:00:00+08:00'))).toBe(1);
  });
  it('counts across a month boundary', () => {
    expect(daysUntil(new Date('2026-08-22T00:00:00+08:00'), new Date('2026-07-27T12:00:00+08:00'))).toBe(26);
  });
  it('counts across a year boundary', () => {
    expect(daysUntil(new Date('2027-01-03T00:00:00+08:00'), new Date('2026-12-30T12:00:00+08:00'))).toBe(4);
  });
  it('is negative for a past day', () => {
    expect(daysUntil(new Date('2026-07-26T00:00:00+08:00'), new Date('2026-07-27T12:00:00+08:00'))).toBe(-1);
  });
});

describe('formatCountdown', () => {
  it('says 就是今天 for 0 and for anything already past', () => {
    expect(formatCountdown(0)).toBe('就是今天');
    expect(formatCountdown(-1)).toBe('就是今天');
  });
  it('says 明天 for 1', () => {
    expect(formatCountdown(1)).toBe('明天');
  });
  it('says 還有 N 天 for larger gaps', () => {
    expect(formatCountdown(26)).toBe('還有 26 天');
  });
});

describe('fetchCalendarEvents', () => {
  it('requests the calendar and normalizes items', async () => {
    let calledUrl;
    const fakeFetch = async (u) => {
      calledUrl = u;
      return { ok: true, json: async () => ({ items: [{ summary: '團練', start: { dateTime: '2026-07-05T14:00:00+08:00' } }] }) };
    };
    const cal = { id: 'abc@group.calendar.google.com', name: '國樂團', color: '#e4c441' };
    const items = await fetchCalendarEvents(cal, { apiKey: 'KEY', now: NOW, fetchImpl: fakeFetch });
    expect(items[0]).toMatchObject({ title: '團練', calName: '國樂團', color: '#e4c441' });
    expect(calledUrl).toContain('/calendars/abc%40group.calendar.google.com/events');
    expect(calledUrl).toContain('key=KEY');
    expect(calledUrl).toContain('singleEvents=true');
  });
  it('throws on HTTP error', async () => {
    const fakeFetch = async () => ({ ok: false, status: 403 });
    await expect(
      fetchCalendarEvents({ id: 'x' }, { apiKey: 'K', now: NOW, fetchImpl: fakeFetch })
    ).rejects.toThrow('403');
  });
  it('requests up to 50 events per calendar so a distant featured event is still found', async () => {
    let calledUrl;
    const fakeFetch = async (u) => { calledUrl = u; return { ok: true, json: async () => ({ items: [] }) }; };
    await fetchCalendarEvents({ id: 'a', name: 'A', color: '#0' }, { apiKey: 'K', now: NOW, fetchImpl: fakeFetch });
    expect(calledUrl).toContain('maxResults=50');
  });
});

describe('fetchUpcoming', () => {
  it('merges calendars, filters upcoming, and sorts', async () => {
    const byId = {
      a: [
        { summary: 'A-future', start: { dateTime: '2026-07-10T10:00:00+08:00' } },
        { summary: 'A-past', start: { dateTime: '2026-06-20T10:00:00+08:00' } },
      ],
      b: [{ summary: 'B-soon', start: { date: '2026-06-28' } }],
    };
    const fakeFetch = async (u) => {
      const id = u.includes('/calendars/a/') ? 'a' : 'b';
      return { ok: true, json: async () => ({ items: byId[id] }) };
    };
    const cals = [
      { id: 'a', name: 'A', color: '#1' },
      { id: 'b', name: 'B', color: '#2' },
    ];
    const items = await fetchUpcoming(cals, { apiKey: 'K', now: NOW, fetchImpl: fakeFetch });
    expect(items.map((e) => e.title)).toEqual(['B-soon', 'A-future']);
  });
  it('tolerates one failing calendar and still returns events from the rest', async () => {
    const fakeFetch = async (u) => {
      if (u.includes('/calendars/bad/')) return { ok: false, status: 403 };
      return { ok: true, json: async () => ({ items: [{ summary: 'OK-event', start: { dateTime: '2026-07-10T10:00:00+08:00' } }] }) };
    };
    const cals = [
      { id: 'bad', name: 'Bad', color: '#0' },
      { id: 'good', name: 'Good', color: '#1' },
    ];
    const items = await fetchUpcoming(cals, { apiKey: 'K', now: NOW, fetchImpl: fakeFetch });
    expect(items.map((e) => e.title)).toEqual(['OK-event']);
  });
  it('throws when every calendar fails', async () => {
    const fakeFetch = async () => ({ ok: false, status: 500 });
    const cals = [{ id: 'a', name: 'A', color: '#0' }, { id: 'b', name: 'B', color: '#1' }];
    await expect(fetchUpcoming(cals, { apiKey: 'K', now: NOW, fetchImpl: fakeFetch })).rejects.toThrow();
  });
  it('returns the full sorted list so callers can slice it themselves', async () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      summary: `E${i}`,
      start: { dateTime: `2026-07-${String(10 + i).padStart(2, '0')}T10:00:00+08:00` },
    }));
    const fakeFetch = async () => ({ ok: true, json: async () => ({ items }) });
    const out = await fetchUpcoming([{ id: 'a', name: 'A', color: '#0' }], { apiKey: 'K', now: NOW, fetchImpl: fakeFetch });
    expect(out).toHaveLength(8);
    expect(out.map((e) => e.title)).toEqual(['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']);
  });
});
