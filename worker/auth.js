// 密碼閘純邏輯：token 簽發／驗證與輸入淨化。
// 只用 Web Crypto（Cloudflare Workers 與 Node 22+ 皆有 global crypto），無任何依賴。
const encoder = new TextEncoder();

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** 簽發 `${expiresMs}.${hmacHex}`；expiresMs 為毫秒時間戳。 */
export async function createToken(secret, expiresMs) {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(String(expiresMs)));
  return `${expiresMs}.${bufToHex(sig)}`;
}

/** token 格式正確、未過期（相對 nowMs）且簽章相符才回 true。 */
export async function verifyToken(secret, token, nowMs) {
  if (typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  if (!/^\d+$/.test(expStr) || Number(expStr) <= nowMs) return false;
  const sig = hexToBuf(token.slice(dot + 1));
  if (!sig) return false;
  const key = await importKey(secret);
  return crypto.subtle.verify('HMAC', key, sig, encoder.encode(expStr));
}

/** 從 Cookie header 取指定名稱的值；找不到回 null。 */
export function getCookie(header, name) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** 只接受站內相對路徑（防 open redirect，含 /\ 反斜線變體——瀏覽器會把 \ 正規化成 /），其餘一律回首頁。 */
export function sanitizeRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || /[\r\n]/.test(value)) return '/';
  return value;
}
