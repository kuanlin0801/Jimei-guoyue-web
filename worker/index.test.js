import { describe, it, expect } from 'vitest';
import worker from './index.js';
import { createToken } from './auth.js';

const okAsset = () => new Response('SITE OK 近期行程', { status: 200 });
function makeEnv(overrides = {}) {
  return {
    SITE_PASSWORD: 'pw123',
    COOKIE_SECRET: 'test-cookie-secret',
    ASSETS: { fetch: () => Promise.resolve(okAsset()) },
    ...overrides,
  };
}

describe('worker fetch handler', () => {
  it('unauthenticated GET / returns the login page', async () => {
    const res = await worker.fetch(new Request('https://example.com/'), makeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('請輸入樂團密碼');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('allowlisted path GET /logo.png bypasses auth and returns the ASSETS response', async () => {
    const res = await worker.fetch(new Request('https://example.com/logo.png'), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('SITE OK 近期行程');
  });

  it('valid cookie GET /calendar returns the ASSETS response', async () => {
    const token = await createToken('test-cookie-secret', Date.now() + 60_000);
    const res = await worker.fetch(
      new Request('https://example.com/calendar', {
        headers: { Cookie: `jimei_gate=${token}` },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('SITE OK 近期行程');
  });

  it('expired/garbage cookie GET / returns the login page', async () => {
    const res = await worker.fetch(
      new Request('https://example.com/', {
        headers: { Cookie: 'jimei_gate=garbage-not-a-token' },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('請輸入樂團密碼');
  });

  it('login success redirects with a Set-Cookie', async () => {
    const body = new URLSearchParams({ password: 'pw123', redirect: '/calendar?x=1' });
    const res = await worker.fetch(
      new Request('https://example.com/__gate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/calendar?x=1');
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('jimei_gate=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Max-Age=2592000');
  });

  it('login wrong password returns the login page with an error', async () => {
    const body = new URLSearchParams({ password: 'wrong', redirect: '/' });
    const res = await worker.fetch(
      new Request('https://example.com/__gate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('密碼不正確');
  });

  it('fail-closed A: unset COOKIE_SECRET with correct password resolves (not rejects) with the login page', async () => {
    const body = new URLSearchParams({ password: 'pw123', redirect: '/' });
    const env = makeEnv({ COOKIE_SECRET: undefined });
    const res = await worker.fetch(
      new Request('https://example.com/__gate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('請輸入樂團密碼');
  });

  it('fail-closed D: JSON body to login resolves with the login page', async () => {
    const res = await worker.fetch(
      new Request('https://example.com/__gate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('請輸入樂團密碼');
  });

  it('unauthenticated GET /__gate/login shows the login page with hidden redirect defaulting to /', async () => {
    const res = await worker.fetch(new Request('https://example.com/__gate/login'), makeEnv());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('請輸入樂團密碼');
    expect(body).toContain('value="/"');
  });

  it('CR/LF in redirect is sanitized away before the Location header is set', async () => {
    const body = new URLSearchParams({ password: 'pw123', redirect: '/x\r\ny' });
    const res = await worker.fetch(
      new Request('https://example.com/__gate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
  });
});
