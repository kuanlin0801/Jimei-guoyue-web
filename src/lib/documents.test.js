import { describe, it, expect } from 'vitest';
import {
  inferType,
  parseDocumentsCsv,
  announcementToDoc,
  buildDocumentList,
} from './documents.js';

describe('inferType', () => {
  it('maps by extension (case-insensitive)', () => {
    expect(inferType('通知單.pdf')).toBe('PDF');
    expect(inferType('photo.JPG')).toBe('圖片');
    expect(inferType('表單.docx')).toBe('Word');
    expect(inferType('名單.xlsx')).toBe('Excel');
  });
  it('returns 檔案 for unknown or missing extension', () => {
    expect(inferType('成果發表會通知單')).toBe('檔案');
    expect(inferType('')).toBe('檔案');
    expect(inferType(undefined)).toBe('檔案');
  });
});

describe('parseDocumentsCsv', () => {
  it('parses rows, skips header, reads pinned, tags source', () => {
    const csv = '日期,名稱,連結,類型,備註,置頂\n2026-06-01,報名表,https://drive.google.com/a,PDF,新生,V\n';
    expect(parseDocumentsCsv(csv)).toEqual([
      { date: '2026-06-01', name: '報名表', url: 'https://drive.google.com/a', type: 'PDF', note: '新生', pinned: true, source: 'document' },
    ]);
  });
  it('blanks an unsafe url but keeps the row', () => {
    const csv = '日期,名稱,連結,類型,備註,置頂\n2026-06-01,壞連結,javascript:alert(1),PDF,,\n';
    const d = parseDocumentsCsv(csv)[0];
    expect(d.url).toBe('');
    expect(d.name).toBe('壞連結');
  });
  it('ignores blank lines', () => {
    const csv = '日期,名稱,連結,類型,備註,置頂\n\n2026-06-01,A,https://x.com,PDF,,\n\n';
    expect(parseDocumentsCsv(csv)).toHaveLength(1);
  });
});

describe('announcementToDoc', () => {
  it('converts an announcement that has an attachment', () => {
    const a = { date: '2026-06-20', title: '成果發表', body: 'x', pinned: true, attachment: { name: '通知單.pdf', url: 'https://drive.google.com/x' } };
    expect(announcementToDoc(a)).toEqual({
      date: '2026-06-20', name: '通知單.pdf', url: 'https://drive.google.com/x',
      type: 'PDF', note: '來自「成果發表」公告', pinned: true, source: 'announcement',
    });
  });
  it('returns null without an attachment', () => {
    expect(announcementToDoc({ date: '2026-06-20', title: 'A', pinned: false, attachment: null })).toBe(null);
  });
});

describe('buildDocumentList', () => {
  it('puts pinned first, then newest date', () => {
    const docs = [
      { date: '2026-06-01', name: 'old-doc', pinned: false, source: 'document' },
      { date: '2026-06-10', name: 'pin-doc', pinned: true, source: 'document' },
    ];
    const anns = [
      { date: '2026-06-05', title: 'A', pinned: false, attachment: { name: 'a', url: 'https://x.com' } },
      { date: '2026-06-20', title: 'B', pinned: true, attachment: { name: 'b', url: 'https://x.com' } },
    ];
    expect(buildDocumentList(anns, docs).map((d) => d.name)).toEqual(['b', 'pin-doc', 'a', 'old-doc']);
  });
  it('keeps document before announcement on the same date (stable)', () => {
    const docs = [{ date: '2026-06-05', name: 'doc', pinned: false, source: 'document' }];
    const anns = [{ date: '2026-06-05', title: 'T', pinned: false, attachment: { name: 'ann', url: 'https://x.com' } }];
    expect(buildDocumentList(anns, docs).map((d) => d.name)).toEqual(['doc', 'ann']);
  });
  it('handles empty inputs', () => {
    expect(buildDocumentList([], [])).toEqual([]);
  });
});
