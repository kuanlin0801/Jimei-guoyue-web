import { describe, it, expect } from 'vitest';
import {
  parseAnnouncementsCsv,
  splitCsvLine,
  fetchAnnouncements,
  isPinnedMark,
  pinnedFirst,
} from './announcements.js';

describe('splitCsvLine', () => {
  it('splits plain comma fields', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('keeps commas inside quoted fields', () => {
    expect(splitCsvLine('2026-06-21,"演出","地點：禮堂，請準時"'))
      .toEqual(['2026-06-21', '演出', '地點：禮堂，請準時']);
  });
  it('unescapes doubled quotes inside a quoted field', () => {
    expect(splitCsvLine('a,"他說 ""你好""",c')).toEqual(['a', '他說 "你好"', 'c']);
  });
});

describe('isPinnedMark', () => {
  it('treats any non-empty, non-negative mark as pinned', () => {
    for (const m of ['V', 'v', '是', '★', 'Y', '1', '✓']) expect(isPinnedMark(m)).toBe(true);
  });
  it('treats blank and explicit negatives as not pinned', () => {
    for (const m of ['', '   ', '否', 'N', 'no', '0', 'false', undefined]) {
      expect(isPinnedMark(m)).toBe(false);
    }
  });
});

describe('parseAnnouncementsCsv', () => {
  it('parses rows, skips the header, and defaults pinned to false', () => {
    const csv = '日期,標題,內容\n2026-06-20,練習異動,本週六改上午九點\n';
    expect(parseAnnouncementsCsv(csv)).toEqual([
      { date: '2026-06-20', title: '練習異動', body: '本週六改上午九點', pinned: false },
    ]);
  });
  it('reads the 置頂 column into a pinned boolean', () => {
    const csv = '日期,標題,內容,置頂\n2026-06-20,A,B,V\n2026-06-19,C,D,\n';
    const items = parseAnnouncementsCsv(csv);
    expect(items[0].pinned).toBe(true);
    expect(items[1].pinned).toBe(false);
  });
  it('ignores blank lines', () => {
    const csv = '日期,標題,內容\n\n2026-06-20,A,B\n\n';
    expect(parseAnnouncementsCsv(csv)).toHaveLength(1);
  });
});

describe('pinnedFirst', () => {
  it('moves pinned items to the top, preserving order within each group', () => {
    const items = [
      { title: 'a', pinned: false },
      { title: 'b', pinned: true },
      { title: 'c', pinned: false },
      { title: 'd', pinned: true },
    ];
    expect(pinnedFirst(items).map((i) => i.title)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('returns a new array without mutating the input', () => {
    const items = [{ title: 'a', pinned: false }];
    expect(pinnedFirst(items)).not.toBe(items);
  });
});

describe('fetchAnnouncements', () => {
  it('fetches then parses the CSV', async () => {
    const csv = '日期,標題,內容,置頂\n2026-06-20,A,B,\n';
    const fakeFetch = async () => ({ ok: true, text: async () => csv });
    const items = await fetchAnnouncements('http://example/csv', { fetchImpl: fakeFetch });
    expect(items).toEqual([{ date: '2026-06-20', title: 'A', body: 'B', pinned: false }]);
  });
  it('throws on HTTP error', async () => {
    const fakeFetch = async () => ({ ok: false, status: 404 });
    await expect(
      fetchAnnouncements('http://example/csv', { fetchImpl: fakeFetch })
    ).rejects.toThrow('404');
  });
});
