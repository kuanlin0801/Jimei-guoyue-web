import { describe, it, expect } from 'vitest';
import { parseAnnouncementsCsv, splitCsvLine, fetchAnnouncements } from './announcements.js';

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

describe('parseAnnouncementsCsv', () => {
  it('parses rows and skips the header', () => {
    const csv = '日期,標題,內容\n2026-06-20,練習異動,本週六改上午九點\n';
    expect(parseAnnouncementsCsv(csv)).toEqual([
      { date: '2026-06-20', title: '練習異動', body: '本週六改上午九點' },
    ]);
  });
  it('ignores blank lines', () => {
    const csv = '日期,標題,內容\n\n2026-06-20,A,B\n\n';
    expect(parseAnnouncementsCsv(csv)).toHaveLength(1);
  });
});

describe('fetchAnnouncements', () => {
  it('fetches then parses the CSV', async () => {
    const csv = '日期,標題,內容\n2026-06-20,A,B\n';
    const fakeFetch = async () => ({ ok: true, text: async () => csv });
    const items = await fetchAnnouncements('http://example/csv', { fetchImpl: fakeFetch });
    expect(items).toEqual([{ date: '2026-06-20', title: 'A', body: 'B' }]);
  });
  it('throws on HTTP error', async () => {
    const fakeFetch = async () => ({ ok: false, status: 404 });
    await expect(
      fetchAnnouncements('http://example/csv', { fetchImpl: fakeFetch })
    ).rejects.toThrow('404');
  });
});
