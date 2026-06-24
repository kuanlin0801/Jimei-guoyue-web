import { describe, it, expect } from 'vitest';
import { summarizeSupport } from './support.js';

const NEEDS = [
  { label: '搬運樂器', target: 2 },
  { label: '現場場佈', target: 3 },
  { label: '攝影記錄', target: 1 },
];

// 模擬 Google 表單回覆試算表的 CSV（標題列＋四筆回覆）
const CSV = [
  '時間戳記,顯示稱呼,能否到場,可幫忙項目',
  '2026/7/1 10:00,小明媽媽,可,"搬運樂器, 現場場佈"',
  '2026/7/1 11:00,小華爸爸,可,現場場佈',
  '2026/7/1 12:00,阿美阿姨,部分,攝影記錄',
  '2026/7/1 13:00,小強媽媽,不可,搬運樂器',
].join('\n') + '\n';

describe('summarizeSupport', () => {
  it('counts helpers and excludes 不可', () => {
    expect(summarizeSupport(CSV, NEEDS).total).toBe(3);
  });
  it('lists helper display names (excluding 不可)', () => {
    expect(summarizeSupport(CSV, NEEDS).names).toEqual(['小明媽媽', '小華爸爸', '阿美阿姨']);
  });
  it('tallies each category against its target with shortfall', () => {
    const byLabel = Object.fromEntries(
      summarizeSupport(CSV, NEEDS).byCategory.map((c) => [c.label, c])
    );
    expect(byLabel['搬運樂器']).toMatchObject({ signed: 1, target: 2, short: 1, enough: false });
    expect(byLabel['現場場佈']).toMatchObject({ signed: 2, short: 1, enough: false });
    expect(byLabel['攝影記錄']).toMatchObject({ signed: 1, short: 0, enough: true });
  });
  it('returns zeros for empty responses', () => {
    const empty = '時間戳記,顯示稱呼,能否到場,可幫忙項目\n';
    const s = summarizeSupport(empty, NEEDS);
    expect(s.total).toBe(0);
    expect(s.byCategory.every((c) => c.signed === 0 && c.enough === false)).toBe(true);
  });
});
