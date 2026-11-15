import { randomUUID } from 'node:crypto';
import { hasAdminSession, jsonResponse, sameOrigin } from '../server/adminAuth.js';
import { supabaseRequest } from '../server/supabase.js';

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=10';
const FRESH_CACHE = 'no-store';
function cachedJson(data, status = 200, fresh = false) {
  return jsonResponse(data, status, { 'Cache-Control': fresh ? FRESH_CACHE : PUBLIC_CACHE });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      try {
        const registryId = url.searchParams.get('registry');
        if (registryId) {
          const query = new URLSearchParams({ select: 'id,name,updated_at', registry_id: 'eq.' + registryId, order: 'updated_at.desc' }).toString();
          const rows = await supabaseRequest('tournament_snapshots?' + query);
          return cachedJson(rows.map(row => ({ name: row.name, binId: row.id, updatedAt: row.updated_at })));
        }
        const id = url.searchParams.get('tournament');
        if (!id) return jsonResponse({ error: 'Tournament identifier is required.' }, 400);
        const fresh = url.searchParams.get('fresh') === '1';
        const query = new URLSearchParams({ select: 'snapshot,updated_at', id: 'eq.' + id, limit: '1' }).toString();
        const rows = await supabaseRequest('tournament_snapshots?' + query);
        if (!rows.length) return cachedJson({ error: 'Tournament snapshot not found.' }, 404, fresh);
        return cachedJson({ ...rows[0].snapshot, updatedAt: rows[0].updated_at || rows[0].snapshot.updatedAt }, 200, fresh);
      } catch {
        return jsonResponse({ error: 'Could not load tournament data from Supabase.' }, 502);
      }
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
    if (!sameOrigin(request)) return jsonResponse({ error: 'Invalid origin.' }, 403);
    if (!hasAdminSession(request)) return jsonResponse({ error: 'Authentication required.' }, 401);
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 2_000_000) return jsonResponse({ error: 'Snapshot is too large.' }, 413);
    let input;
    try { input = await request.json(); }
    catch { return jsonResponse({ error: 'Invalid request.' }, 400); }
    if (!input || typeof input.eventName !== 'string' || !input.eventName.trim()
      || !input.snapshot || typeof input.snapshot !== 'object' || Array.isArray(input.snapshot)) {
      return jsonResponse({ error: 'Invalid tournament snapshot.' }, 400);
    }
    const id = typeof input.eventBinId === 'string' && input.eventBinId ? input.eventBinId : randomUUID();
    const registryId = typeof input.registryId === 'string' && input.registryId ? input.registryId : randomUUID();
    if (id.length > 200 || registryId.length > 200 || JSON.stringify(input.snapshot).length > 1_800_000) {
      return jsonResponse({ error: 'Snapshot is too large or has an invalid identifier.' }, 413);
    }
    const updatedAt = typeof input.snapshot.updatedAt === 'string' ? input.snapshot.updatedAt : new Date().toISOString();
    try {
      await supabaseRequest('tournament_snapshots?on_conflict=id', {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
        body: [{ id, registry_id: registryId, name: input.eventName.trim().slice(0, 160), snapshot: input.snapshot, updated_at: updatedAt }]
      });
      return jsonResponse({ eventBinId: id, registryId, updatedAt });
    } catch {
      return jsonResponse({ error: 'Could not publish tournament data to Supabase.' }, 502);
    }
  }
};
