import { describe, it, expect } from 'vitest';
import { splitCsvLine, parseCsvRows } from './csv.js';

describe('splitCsvLine', () => {
  it('keeps commas inside quoted fields', () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });
});

describe('parseCsvRows', () => {
  it('maps each row to an object keyed by header', () => {
    const csv = '顯示稱呼,可幫忙項目\n小明媽媽,"搬運樂器, 現場場佈"\n';
    expect(parseCsvRows(csv)).toEqual([
      { 顯示稱呼: '小明媽媽', 可幫忙項目: '搬運樂器, 現場場佈' },
    ]);
  });
  it('skips blank lines and trims headers and values', () => {
    const csv = '日期 , 標題 \n\n 2026-06-20 , A \n';
    expect(parseCsvRows(csv)).toEqual([{ 日期: '2026-06-20', 標題: 'A' }]);
  });
  it('fills missing trailing columns with empty string', () => {
    const csv = 'a,b,c\n1,2\n';
    expect(parseCsvRows(csv)).toEqual([{ a: '1', b: '2', c: '' }]);
  });
  it('returns an empty array for empty input', () => {
    expect(parseCsvRows('')).toEqual([]);
  });
});
