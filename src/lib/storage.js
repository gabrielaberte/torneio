import { uid } from './constants';

export function defaultState() {
  return {
    roster: [],
    teamEntries: [],
    playerStats: {},
    standings: {},
    history: [],
    bracket: { groupA: [], groupB: [], matches: [] },
    current: null,
    modal: null,
    updatedAt: null,
    jsonbin: { id: '' },   // bin de publicaÃ§Ã£o pÃºblica deste torneio (classificaÃ§Ã£o)
    sync: { binId: '' }    // bin privado de sincronizaÃ§Ã£o deste torneio (tudo)
  };
}

export function normalizeEventState(incoming) {
  const defaults = defaultState();
  const state = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
  return {
    ...defaults,
    ...state,
    roster: Array.isArray(state.roster) ? state.roster : defaults.roster,
    playerStats: state.playerStats && typeof state.playerStats === 'object' ? state.playerStats : defaults.playerStats,
    standings: state.standings && typeof state.standings === 'object' ? state.standings : defaults.standings,
    history: Array.isArray(state.history) ? state.history : defaults.history,
    bracket: state.bracket && typeof state.bracket === 'object'
      ? { ...defaults.bracket, ...state.bracket }
      : defaults.bracket,
    jsonbin: state.jsonbin && typeof state.jsonbin === 'object'
      ? { ...defaults.jsonbin, ...state.jsonbin }
      : defaults.jsonbin,
    sync: state.sync && typeof state.sync === 'object'
      ? { ...defaults.sync, ...state.sync }
      : defaults.sync
  };
}
/* ---------- Lista de torneios (eventos) ---------- */
export function getEvents() {
  try { return JSON.parse(localStorage.getItem('volei_events') || '[]'); }
  catch (e) { return []; }
}
export function saveEvents(list) {
  localStorage.setItem('volei_events', JSON.stringify(list));
}
export function renameEventEntry(id, name) {
  const events = getEvents().map(event => event.id === id ? { ...event, name } : event);
  saveEvents(events);
  return events;
}
export function createEventEntry(name) {
  const events = getEvents();
  const id = uid();
  events.push({ id, name, createdAt: new Date().toISOString() });
  saveEvents(events);
  return id;
}
export function deleteEventEntry(id) {
  saveEvents(getEvents().filter(e => e.id !== id));
  localStorage.removeItem('volei_state_' + id);
  localStorage.removeItem('volei_sync_pending_' + id);
}

/* ---------- Estado de cada torneio ---------- */
export function loadEventState(id) {
  let state = defaultState();
  try {
    const raw = localStorage.getItem('volei_state_' + id);
    if (raw) state = normalizeEventState(JSON.parse(raw));
  } catch (e) { /* torneio novo, tudo bem */ }
  return state;
}
export function saveEventState(id, state) {
  if (!id) return;
  const toSave = Object.assign({}, state, { updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem('volei_state_' + id, JSON.stringify(toSave));
  } catch (e) {
    console.warn('NÃ£o foi possÃ­vel salvar agora.', e);
  }
  return toSave.updatedAt;
}

/* ---------- Conta / preferÃªncias globais (mesmo aparelho) ---------- */
export function getRole() { return localStorage.getItem('volei_role'); }
export function setRole(r) { localStorage.setItem('volei_role', r); }
export function clearRole() { localStorage.removeItem('volei_role'); }

export function getCurrentEventId() { return localStorage.getItem('volei_current_event'); }
export function setCurrentEventId(id) { localStorage.setItem('volei_current_event', id); }
export function clearCurrentEventId() { localStorage.removeItem('volei_current_event'); }

export function isUnlocked() { return sessionStorage.getItem('volei_unlocked') === '1'; }
export function setUnlocked() { sessionStorage.setItem('volei_unlocked', '1'); }
export function getPin() { return localStorage.getItem('volei_admin_pin'); }
export function setPin(pin) { localStorage.setItem('volei_admin_pin', pin); }
export function resetPin() { localStorage.removeItem('volei_admin_pin'); }

export function clearLegacyJsonbinKey() { localStorage.removeItem('volei_jsonbin_key'); }
export function getRegistryId() { return localStorage.getItem('volei_registry_id') || ''; }
export function setRegistryId(id) { localStorage.setItem('volei_registry_id', id); }
export function getViewerUrl() { return localStorage.getItem('volei_viewer_url') || ''; }
export function setViewerUrl(url) { localStorage.setItem('volei_viewer_url', url); }

export function getPendingPublicationIds() {
  try { return JSON.parse(localStorage.getItem('volei_pending_publications') || '[]'); }
  catch (e) { return []; }
}
export function markPublicationPending(eventId) {
  const ids = getPendingPublicationIds();
  if (!ids.includes(eventId)) localStorage.setItem('volei_pending_publications', JSON.stringify([...ids, eventId]));
}
export function clearPendingPublication(eventId) {
  localStorage.setItem('volei_pending_publications', JSON.stringify(getPendingPublicationIds().filter(id => id !== eventId)));
}

export function isSyncPending(eventId) { return localStorage.getItem('volei_sync_pending_' + eventId) === '1'; }
export function markSyncPending(eventId) { localStorage.setItem('volei_sync_pending_' + eventId, '1'); }
export function clearSyncPending(eventId) { localStorage.removeItem('volei_sync_pending_' + eventId); }

/* ---------- Backup manual (texto) ---------- */
export function exportBackupText(eventName, state) {
  return JSON.stringify({ eventName, state });
}
export function parseBackupText(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed.state) throw new Error('Backup invÃ¡lido');
  return parsed;
}

