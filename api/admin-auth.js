import { checkAdminPassword, clearSessionCookie, hasAdminSession, jsonResponse, makeSessionCookie, sameOrigin } from '../server/adminAuth.js';

export default {
  async fetch(request) {
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
      return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, DELETE' });
    }
    if (request.method !== 'GET' && !sameOrigin(request)) return jsonResponse({ error: 'Invalid origin.' }, 403);

    if (request.method === 'GET') {
      return hasAdminSession(request)
        ? jsonResponse({ authenticated: true })
        : jsonResponse({ authenticated: false }, 401);
    }

    if (request.method === 'DELETE') {
      return jsonResponse({ authenticated: false }, 200, { 'Set-Cookie': clearSessionCookie() });
    }

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ error: 'Invalid request.' }, 400); }
    if (!body || typeof body.password !== 'string' || body.password.length > 256) {
      return jsonResponse({ error: 'Invalid credentials.' }, 401);
    }
    try {
      if (!checkAdminPassword(body.password)) return jsonResponse({ error: 'Invalid credentials.' }, 401);
      return jsonResponse({ authenticated: true }, 200, { 'Set-Cookie': makeSessionCookie() });
    } catch {
      return jsonResponse({ error: 'Server authentication is not configured.' }, 503);
    }
  }
};
