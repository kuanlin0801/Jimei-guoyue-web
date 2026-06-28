import { describe, it, expect } from 'vitest';
import { pad, buildPages, formatPageLabel } from './flipbook.js';

describe('pad', () => {
  it('zero-pads to width 2 by default', () => {
    expect(pad(1)).toBe('01');
    expect(pad(25)).toBe('25');
  });
  it('respects an explicit width', () => {
    expect(pad(5, 3)).toBe('005');
  });
});

describe('buildPages', () => {
  it('returns one descriptor per page with padded paths and alt text', () => {
    const pages = buildPages(25);
    expect(pages).toHaveLength(25);
    expect(pages[0]).toEqual({
      index: 1,
      src: '/intro/page-01.jpg',
      thumb: '/intro/thumb-01.jpg',
      alt: '社團介紹 第 1 頁',
    });
    expect(pages[24].src).toBe('/intro/page-25.jpg');
    expect(pages[24].thumb).toBe('/intro/thumb-25.jpg');
  });
  it('honors a custom dir', () => {
    expect(buildPages(1, { dir: '/x' })[0].src).toBe('/x/page-01.jpg');
  });
  it('returns an empty array for count 0', () => {
    expect(buildPages(0)).toEqual([]);
  });
});

describe('formatPageLabel', () => {
  it('formats as "current / total"', () => {
    expect(formatPageLabel(3, 25)).toBe('3 / 25');
  });
});
