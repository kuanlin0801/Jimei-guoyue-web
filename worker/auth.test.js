import { describe, it, expect } from 'vitest';
import { createToken, verifyToken, getCookie, sanitizeRedirect } from './auth.js';

const SECRET = 'test-secret';
const NOW = 1_700_000_000_000;

describe('createToken / verifyToken', () => {
  it('accepts a fresh token signed with the same secret', async () => {
    const token = await createToken(SECRET, NOW + 1000);
    expect(await verifyToken(SECRET, token, NOW)).toBe(true);
  });

  it('rejects an expired token', async () => {
    const token = await createToken(SECRET, NOW - 1);
    expect(await verifyToken(SECRET, token, NOW)).toBe(false);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createToken('other-secret', NOW + 1000);
    expect(await verifyToken(SECRET, token, NOW)).toBe(false);
  });

  it('rejects a token whose expiry was tampered with', async () => {
    const token = await createToken(SECRET, NOW + 1000);
    const sig = token.slice(token.indexOf('.') + 1);
    expect(await verifyToken(SECRET, `${NOW + 999_999_999}.${sig}`, NOW)).toBe(false);
  });

  it('rejects malformed tokens', async () => {
    for (const bad of [null, undefined, '', 'no-dot', '.abc', '123.', '123.zz', 'abc.def', '12.3.deadbeef']) {
      expect(await verifyToken(SECRET, bad, NOW)).toBe(false);
    }
  });
});

describe('getCookie', () => {
  it('finds the named cookie among several', () => {
    expect(getCookie('a=1; jimei_gate=tok123; b=2', 'jimei_gate')).toBe('tok123');
  });

  it('does not match a cookie whose name merely ends with the target', () => {
    expect(getCookie('xjimei_gate=evil', 'jimei_gate')).toBe(null);
  });

  it('returns null when absent or header missing', () => {
    expect(getCookie('a=1', 'jimei_gate')).toBe(null);
    expect(getCookie(null, 'jimei_gate')).toBe(null);
    expect(getCookie('', 'jimei_gate')).toBe(null);
  });
});

describe('sanitizeRedirect', () => {
  it('keeps same-site relative paths (with query)', () => {
    expect(sanitizeRedirect('/announcements?x=1')).toBe('/announcements?x=1');
    expect(sanitizeRedirect('/')).toBe('/');
  });

  it('falls back to / for absolute URLs, protocol-relative URLs, or junk', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined, 'calendar', '/x\r\ny']) {
      expect(sanitizeRedirect(bad)).toBe('/');
    }
  });
});
