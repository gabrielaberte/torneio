import { hasAdminSession, jsonResponse, sameOrigin } from '../server/adminAuth.js';

const JSONBIN_BASE = 'https://api.jsonbin.io';

function allowedRequest(path, method) {
  if (path === '/v3/b' && method === 'POST') return true;
  if (/^\/v3\/b\/[A-Za-z0-9_-]+$/.test(path) && method === 'PUT') return true;
  if (/^\/v3\/b\/[A-Za-z0-9_-]+\/latest$/.test(path) && method === 'GET') return true;
  return false;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
    if (!sameOrigin(request)) return jsonResponse({ error: 'Invalid origin.' }, 403);
    if (!hasAdminSession(request)) return jsonResponse({ error: 'Authentication required.' }, 401);

    let input;
    try { input = await request.json(); }
    catch { return jsonResponse({ error: 'Invalid request.' }, 400); }
    const path = input && input.path;
    const method = input && String(input.method || '').toUpperCase();
    if (typeof path !== 'string' || !allowedRequest(path, method)) {
      return jsonResponse({ error: 'Operation not allowed.' }, 400);
    }

    const masterKey = process.env.JSONBIN_MASTER_KEY;
    if (!masterKey) return jsonResponse({ error: 'JSONBin is not configured on the server.' }, 503);

    const headers = new Headers({ 'X-Master-Key': masterKey });
    if (method === 'POST') {
      headers.set('Content-Type', 'application/json');
      if (input.headers && input.headers.binPrivate === 'true') headers.set('X-Bin-Private', 'true');
      if (input.headers && input.headers.binPrivate === 'false') headers.set('X-Bin-Private', 'false');
      if (input.headers && typeof input.headers.binName === 'string') {
        headers.set('X-Bin-Name', input.headers.binName.slice(0, 120));
      }
    } else if (method === 'PUT') {
      headers.set('Content-Type', 'application/json');
    }

    let body;
    if (method === 'POST' || method === 'PUT') {
      if (typeof input.body !== 'string' || input.body.length > 2_000_000) {
        return jsonResponse({ error: 'Invalid payload.' }, 400);
      }
      body = input.body;
      try { JSON.parse(body); }
      catch { return jsonResponse({ error: 'Invalid JSON payload.' }, 400); }
    }

    try {
      const upstream = await fetch(JSONBIN_BASE + path, { method, headers, body });
      const responseText = await upstream.text();
      return new Response(responseText, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    } catch {
      return jsonResponse({ error: 'JSONBin request failed.' }, 502);
    }
  }
};
