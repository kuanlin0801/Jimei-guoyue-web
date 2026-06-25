import { describe, it, expect } from 'vitest';
import {
  parseStart,
  normalize,
  toUpcoming,
  takeNext,
  formatMonthDay,
  formatWeekday,
  formatTime,
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
});

describe('fetchUpcoming', () => {
  it('merges calendars, filters upcoming, sorts, and takes count', async () => {
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
    const items = await fetchUpcoming(cals, { apiKey: 'K', now: NOW, count: 5, fetchImpl: fakeFetch });
    expect(items.map((e) => e.title)).toEqual(['B-soon', 'A-future']);
  });
});
