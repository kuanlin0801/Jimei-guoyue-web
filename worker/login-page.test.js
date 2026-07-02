import { describe, it, expect } from 'vitest';
import { renderLoginPage } from './login-page.js';

const base = { redirectTo: '/', error: null, origin: 'https://example.com' };

describe('renderLoginPage', () => {
  it('includes OG meta with an absolute logo URL so LINE link previews stay intact', () => {
    const html = renderLoginPage(base);
    expect(html).toContain('property="og:title" content="集美國小國樂團"');
    expect(html).toContain('property="og:image" content="https://example.com/logo.png"');
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).toContain('lang="zh-Hant"');
  });

  it('posts to the gate login path and carries the redirect target', () => {
    const html = renderLoginPage({ ...base, redirectTo: '/calendar' });
    expect(html).toContain('action="/__gate/login"');
    expect(html).toContain('name="redirect" value="/calendar"');
    expect(html).toContain('請輸入樂團密碼');
  });

  it('shows the error message only when provided', () => {
    expect(renderLoginPage(base)).not.toContain('gate-error');
    expect(renderLoginPage({ ...base, error: '密碼不正確，請再試一次' })).toContain('密碼不正確，請再試一次');
  });

  it('escapes the redirect value so it cannot break out of the attribute', () => {
    const html = renderLoginPage({ ...base, redirectTo: '/"><script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('value="/&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
  });
});
