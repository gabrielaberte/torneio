import { randomUUID } from 'node:crypto';
import { hasAdminSession, jsonResponse, sameOrigin } from '../server/adminAuth.js';
import { supabaseRequest } from '../server/supabase.js';

export default {
  async fetch(request) {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
    if (!sameOrigin(request)) return jsonResponse({ error: 'Invalid origin.' }, 403);
    if (!hasAdminSession(request)) return jsonResponse({ error: 'Authentication required.' }, 401);
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 2_500_000) return jsonResponse({ error: 'Tournament data is too large.' }, 413);
    let input;
    try { input = await request.json(); }
    catch { return jsonResponse({ error: 'Invalid request.' }, 400); }
    if (!input || !['activate', 'push', 'pull'].includes(input.action)) return jsonResponse({ error: 'Invalid synchronization action.' }, 400);
    if (input.action === 'pull') {
      if (typeof input.binId !== 'string' || !input.binId || input.binId.length > 200) return jsonResponse({ error: 'Invalid synchronization identifier.' }, 400);
      try {
        const query = new URLSearchParams({ select: 'event_name,state,updated_at', id: 'eq.' + input.binId, limit: '1' }).toString();
        const rows = await supabaseRequest('tournament_sync?' + query);
        if (!rows.length) return jsonResponse({ record: null });
        return jsonResponse({ record: { eventName: rows[0].event_name, updatedAt: rows[0].updated_at, state: rows[0].state } });
      } catch {
        return jsonResponse({ error: 'Could not load private tournament data.' }, 502);
      }
    }
    if (!input.state || typeof input.state !== 'object' || Array.isArray(input.state)
      || typeof input.eventName !== 'string' || !input.eventName.trim()) return jsonResponse({ error: 'Invalid tournament data.' }, 400);
    if (JSON.stringify(input.state).length > 2_000_000) return jsonResponse({ error: 'Tournament data is too large.' }, 413);
    const id = input.action === 'activate' ? randomUUID() : typeof input.binId === 'string' && input.binId ? input.binId : '';
    if (!id || id.length > 200) return jsonResponse({ error: 'Invalid synchronization identifier.' }, 400);
    const updatedAt = typeof input.state.updatedAt === 'string' ? input.state.updatedAt : new Date().toISOString();
    try {
      await supabaseRequest('tournament_sync?on_conflict=id', {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
        body: [{ id, event_name: input.eventName.trim().slice(0, 160), state: input.state, updated_at: updatedAt }]
      });
      return jsonResponse({ binId: id, updatedAt });
    } catch {
      return jsonResponse({ error: 'Could not save private tournament data.' }, 502);
    }
  }
};
