import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'volei_admin';
const SESSION_SECONDS = 8 * 60 * 60;

function equalSecret(left, right) {
  const leftHash = createHash('sha256').update(String(left || '')).digest();
  const rightHash = createHash('sha256').update(String(right || '')).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function secret(name, minLength) {
  const value = process.env[name] || '';
  if (value.length < minLength) throw new Error('Server authentication is not configured.');
  return value;
}

function signExpiry(expiry) {
  return createHmac('sha256', secret('VOLEI_SESSION_SECRET', 32))
    .update(String(expiry))
    .digest('base64url');
}

export function checkAdminPassword(value) {
  const expected = secret('VOLEI_ADMIN_PASSWORD', 8);
  return equalSecret(value, expected);
}

export function makeSessionCookie() {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = String(expiry) + '.' + signExpiry(expiry);
  return COOKIE_NAME + '=' + value + '; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=' + SESSION_SECONDS;
}

export function clearSessionCookie() {
  return COOKIE_NAME + '=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0';
}

export function hasAdminSession(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookie = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE_NAME + '='));
  if (!cookie) return false;
  const value = cookie.slice(COOKIE_NAME.length + 1);
  const separator = value.indexOf('.');
  if (separator < 1) return false;
  const expiry = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!/^\d+$/.test(expiry) || Number(expiry) <= Math.floor(Date.now() / 1000)) return false;
  try {
    return equalSecret(signature, signExpiry(expiry));
  } catch {
    return false;
  }
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}
