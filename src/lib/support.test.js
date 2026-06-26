import { describe, it, expect } from 'vitest';
import { buildSupportView } from './support.js';

const find = (view, name) => view.find((a) => a.name === name);
const job = (act, label = '') => act.jobs.find((j) => j.label === label);

describe('buildSupportView — 接龍', () => {
  const data = {
    activities: [
      { 名稱: '早自習跑班', 日期: '2026-06-29', 時間: '8:00-8:40', 類型: '接龍', 狀態: '開放', 需求人數: '8', 說明: '需搬樂器', 'LINE連結': '' },
    ],
    jobs: [],
    responses: [
      { 時間戳記: '1', 活動: '早自習跑班', 工作: '', 稱呼: '侑亭媽' },
      { 時間戳記: '2', 活動: '早自習跑班', 工作: '', 稱呼: '彥辰媽' },
      { 時間戳記: '3', 活動: '早自習跑班', 工作: '', 稱呼: '芳語爸' },
    ],
  };
  it('一個隱含工作、名單依序、進度正確', () => {
    const act = find(buildSupportView(data), '早自習跑班');
    expect(act.type).toBe('接龍');
    expect(act.jobs).toHaveLength(1);
    const j = job(act);
    expect(j.names).toEqual(['侑亭媽', '彥辰媽', '芳語爸']);
    expect(j).toMatchObject({ target: 8, signed: 3, short: 5, enough: false, canClaim: true });
    expect(act.total).toBe(3);
  });
  it('達標後 enough 為真、canClaim 為假', () => {
    const full = { ...data, activities: [{ ...data.activities[0], 需求人數: '3' }] };
    const j = job(find(buildSupportView(full), '早自習跑班'));
    expect(j).toMatchObject({ signed: 3, short: 0, enough: true, canClaim: false });
  });
  it('需求人數空白 → target 為 null，仍可報名', () => {
    const open = { ...data, activities: [{ ...data.activities[0], 需求人數: '' }] };
    const j = job(find(buildSupportView(open), '早自習跑班'));
    expect(j.target).toBeNull();
    expect(j).toMatchObject({ short: 0, enough: false, canClaim: true });
  });
});

describe('buildSupportView — 分工', () => {
  const data = {
    activities: [
      { 名稱: '新生準備日', 日期: '2026-08-22', 時間: '10:00', 類型: '分工', 狀態: '開放', 需求人數: '', 說明: '', 'LINE連結': '' },
    ],
    jobs: [
      { 活動: '新生準備日', 工作: '主持人', 需求人數: '1', 指定: '黃子玉' },
      { 活動: '新生準備日', 工作: '搬樂器', 需求人數: '4', 指定: '' },
      { 活動: '新生準備日', 工作: '攝影', 需求人數: '1', 指定: '' },
    ],
    responses: [
      { 時間戳記: '1', 活動: '新生準備日', 工作: '搬樂器', 稱呼: '王爸' },
      { 時間戳記: '2', 活動: '新生準備日', 工作: '攝影', 稱呼: '陳媽' },
      { 時間戳記: '3', 活動: '新生準備日', 工作: '搬樂器', 稱呼: '王爸' },
    ],
  };
  it('指定者已內定：assignedFixed、enough、不可認領', () => {
    const j = job(find(buildSupportView(data), '新生準備日'), '主持人');
    expect(j).toMatchObject({ assignedFixed: true, enough: true, canClaim: false });
    expect(j.names).toEqual(['黃子玉']);
  });
  it('開放工作：依報名計算 signed/short，未滿可認領', () => {
    const j = job(find(buildSupportView(data), '新生準備日'), '搬樂器');
    expect(j.names).toEqual(['王爸', '王爸']); // 純邏輯不去重，呈現層處理
    expect(j).toMatchObject({ target: 4, signed: 2, short: 2, enough: false, canClaim: true });
  });
  it('開放工作達標：足夠、不可認領', () => {
    const j = job(find(buildSupportView(data), '新生準備日'), '攝影');
    expect(j).toMatchObject({ target: 1, signed: 1, enough: true, canClaim: false });
  });
  it('total 為跨工作不重複的稱呼數（含內定者；王爸只算一次）', () => {
    // 黃子玉(內定) + 王爸(報名兩次算一次) + 陳媽 = 3
    expect(find(buildSupportView(data), '新生準備日').total).toBe(3);
  });
});

describe('buildSupportView — 狀態、排序、安全、空值', () => {
  it('結束→ended、額滿→full，皆不可認領，結束排最後', () => {
    const view = buildSupportView({
      activities: [
        { 名稱: '已結束', 日期: '2026-01-01', 類型: '接龍', 狀態: '結束', 需求人數: '5' },
        { 名稱: '額滿中', 日期: '2026-12-01', 類型: '接龍', 狀態: '額滿', 需求人數: '5' },
        { 名稱: '開放中', 日期: '2026-07-01', 類型: '接龍', 狀態: '開放', 需求人數: '5' },
      ],
      jobs: [], responses: [],
    });
    expect(view.map((a) => a.name)).toEqual(['開放中', '額滿中', '已結束']); // 未結束依日期升冪、結束殿後
    expect(find(view, '已結束')).toMatchObject({ ended: true });
    expect(job(find(view, '已結束')).canClaim).toBe(false);
    expect(find(view, '額滿中')).toMatchObject({ full: true, open: false });
    expect(job(find(view, '額滿中')).canClaim).toBe(false);
  });
  it('lineUrl 僅保留 http(s)，擋 javascript:', () => {
    const view = buildSupportView({
      activities: [
        { 名稱: 'A', 日期: '2026-07-01', 類型: '接龍', 狀態: '開放', 需求人數: '1', 'LINE連結': 'javascript:alert(1)' },
        { 名稱: 'B', 日期: '2026-07-02', 類型: '接龍', 狀態: '開放', 需求人數: '1', 'LINE連結': 'https://line.me/x' },
      ], jobs: [], responses: [],
    });
    expect(find(view, 'A').lineUrl).toBe('');
    expect(find(view, 'B').lineUrl).toBe('https://line.me/x');
  });
  it('空輸入回空陣列', () => {
    expect(buildSupportView({ activities: [], jobs: [], responses: [] })).toEqual([]);
    expect(buildSupportView({})).toEqual([]);
  });
  it('類型空白預設為接龍', () => {
    const view = buildSupportView({ activities: [{ 名稱: 'X', 日期: '2026-07-01', 需求人數: '2' }], jobs: [], responses: [] });
    expect(find(view, 'X').type).toBe('接龍');
  });
});
