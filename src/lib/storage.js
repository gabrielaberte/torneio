import { uid } from './constants';

export function defaultState() {
  return {
    roster: [],
    playerStats: {},
    standings: {},
    history: [],
    bracket: { groupA: [], groupB: [], matches: [] },
    current: null,
    modal: null,
    updatedAt: null,
    jsonbin: { id: '' },   // bin de publicação pública deste torneio (classificação)
    sync: { binId: '' }    // bin privado de sincronização deste torneio (tudo)
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
}

/* ---------- Estado de cada torneio ---------- */
export function loadEventState(id) {
  let state = defaultState();
  try {
    const raw = localStorage.getItem('volei_state_' + id);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) { /* torneio novo, tudo bem */ }
  return state;
}
export function saveEventState(id, state) {
  if (!id) return;
  const toSave = Object.assign({}, state, { updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem('volei_state_' + id, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Não foi possível salvar agora.', e);
  }
  return toSave.updatedAt;
}

/* ---------- Conta / preferências globais (mesmo aparelho) ---------- */
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

export function getJsonbinKey() { return localStorage.getItem('volei_jsonbin_key') || ''; }
export function setJsonbinKey(key) { localStorage.setItem('volei_jsonbin_key', key); }
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

/* ---------- Backup manual (texto) ---------- */
export function exportBackupText(eventName, state) {
  return JSON.stringify({ eventName, state });
}
export function parseBackupText(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed.state) throw new Error('Backup inválido');
  return parsed;
}
