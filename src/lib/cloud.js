// JSONBin public reads stay direct. Administrative writes and private reads go through Vercel Functions.
const BASE = 'https://api.jsonbin.io/v3/b';

const AWARD_KEYS = ['mvp', 'bestServer', 'bestDefense', 'bestAttack', 'topScorer', 'bestBlocker'];
const PODIUM_KEYS = ['first', 'second', 'third'];
const POT_COLORS = ['#d9e6f2', '#b9d9c8', '#f5dfa2', '#efc1a6', '#d8c1e8'];

function projectCounts(source, allowedKeys) {
  const input = source && typeof source === 'object' ? source : {};
  return Object.fromEntries(allowedKeys
    .filter(key => Object.prototype.hasOwnProperty.call(input, key)
      && (input[key] === null || (Number.isInteger(input[key]) && input[key] >= 0)))
    .map(key => [key, input[key]]));
}

export function projectScoutingPlayer(player) {
  const history = player.scoutingHistory || {};
  return {
    id: String(player.id || ''),
    name: String(player.name || ''),
    photo: typeof player.photo === 'string' ? player.photo : '',
    team: String(player.team || ''),
    isCaptain: player.isCaptain === true,
    potColor: Number.isInteger(player.pot) && player.pot >= 0 && player.pot <= 4 ? POT_COLORS[player.pot] : null,
    awards: projectCounts(history.awards, AWARD_KEYS),
    podiums: projectCounts(history.podiums, PODIUM_KEYS)
  };
}

async function readJson(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error((data && data.error) || (data && data.message) || ('HTTP ' + response.status));
  return data;
}

async function publicFetch(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error((data && data.message) || ('HTTP ' + response.status));
  return data;
}

async function adminJson(path, method, options = {}) {
  const response = await fetch('/api/jsonbin', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      method,
      headers: options.headers || {},
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    })
  });
  return readJson(response);
}

async function authRequest(method, body) {
  const response = await fetch('/api/admin-auth', {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  return readJson(response);
}

export async function loginAdmin(password) {
  return authRequest('POST', { password });
}

export async function checkAdminSession() {
  try {
    await authRequest('GET');
    return true;
  } catch {
    return false;
  }
}

export async function logoutAdmin() {
  await authRequest('DELETE');
}

export async function ensureEventBin(eventName, existingId) {
  if (existingId) return existingId;
  const data = await adminJson('/v3/b', 'POST', {
    headers: { binPrivate: 'false', binName: eventName },
    body: { updatedAt: new Date().toISOString(), standings: [], matches: [], schedule: [], scoutingPlayers: [] }
  });
  return data.metadata.id;
}

export async function ensureRegistry(existingId) {
  if (existingId) return existingId;
  const data = await adminJson('/v3/b', 'POST', {
    headers: { binPrivate: 'false', binName: 'Índice de Torneios' },
    body: { tournaments: [] }
  });
  return data.metadata.id;
}

export async function updateRegistry(registryId, eventBinId, eventName) {
  let list = [];
  try {
    const data = await publicFetch(BASE + '/' + registryId + '/latest');
    list = (data && data.record && data.record.tournaments) || [];
  } catch { /* Índice ainda vazio ou indisponível. */ }
  const idx = list.findIndex(t => t.binId === eventBinId);
  const entry = { name: eventName, binId: eventBinId, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  await adminJson('/v3/b/' + registryId, 'PUT', { body: { tournaments: list } });
}

export async function publishSnapshot(eventName, jsonbinId, registryId, teams, standings, history, bracket, current, roster = []) {
  const snapshot = {
    updatedAt: new Date().toISOString(),
    standings: teams.map(team => ({ name: team, wins: standings[team] || 0 })).sort((a, b) => b.wins - a.wins),
    matches: history.map(match => ({
      teamA: match.teamA, teamB: match.teamB,
      setsWonA: match.setsWonA, setsWonB: match.setsWonB, winner: match.winner
    })),
    schedule: ((bracket && bracket.matches) || []).map(match => ({
      id: match.id, phase: match.phase, teamA: match.teamA, teamB: match.teamB,
      scheduledAt: match.scheduledAt, status: match.status
    })),
    scoutingPlayers: (roster || []).map(projectScoutingPlayer),
    groups: bracket ? { groupA: bracket.groupA || [], groupB: bracket.groupB || [] } : { groupA: [], groupB: [] },
    liveMatch: current ? {
      teamA: current.teamA, teamB: current.teamB, scoreA: current.currentSet.a,
      scoreB: current.currentSet.b, setsWonA: current.setsWonA, setsWonB: current.setsWonB,
      setNumber: current.sets.length + 1
    } : null
  };
  const eventBinId = await ensureEventBin(eventName, jsonbinId);
  await adminJson('/v3/b/' + eventBinId, 'PUT', { body: snapshot });
  const resolvedRegistryId = await ensureRegistry(registryId);
  await updateRegistry(resolvedRegistryId, eventBinId, eventName);
  return { eventBinId, registryId: resolvedRegistryId };
}

export async function activateSync(eventName, state) {
  const data = await adminJson('/v3/b', 'POST', {
    headers: { binPrivate: 'true', binName: 'sync-' + eventName },
    body: { eventName, updatedAt: state.updatedAt, state }
  });
  return data.metadata.id;
}

export async function pushCloud(binId, eventName, state) {
  try {
    await adminJson('/v3/b/' + binId, 'PUT', {
      body: { eventName, updatedAt: state.updatedAt, state }
    });
    return true;
  } catch {
    return false;
  }
}

export async function pullCloud(binId) {
  const data = await adminJson('/v3/b/' + binId + '/latest', 'GET');
  return data && data.record;
}

export async function importSyncedEvent(code) {
  const record = await pullCloud(code);
  if (!record || !record.state) throw new Error('Código não encontrado');
  return record;
}

export async function fetchRegistryList(registryId) {
  const data = await publicFetch(BASE + '/' + registryId + '/latest');
  return (data && data.record && data.record.tournaments) || [];
}

export async function fetchPublicSnapshot(binId) {
  const data = await publicFetch(BASE + '/' + binId + '/latest');
  return data && data.record;
}
