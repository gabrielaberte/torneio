const AWARD_KEYS = ['mvp', 'bestServer', 'bestDefense', 'bestAttack', 'topScorer', 'bestBlocker'];
const PODIUM_KEYS = ['first', 'second', 'third'];
const POT_COLORS = ['#d9e6f2', '#b9d9c8', '#f5dfa2', '#efc1a6', '#d8c1e8'];
const PUBLIC_STAT_KEYS = ['points', 'aces', 'attacksGood', 'attacksBad', 'blocks', 'netTouches', 'serveErrors', 'mishits', 'drops', 'mvp'];
const DEFAULT_REGISTRY_ID = '6ad30e27ffd5d1605372d8bd';

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

async function backendJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  return readJson(response);
}

async function authRequest(method, body) {
  return backendJson('/api/admin-auth', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
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

export function buildPublicSnapshot(teams, standings, history, bracket, current, roster = [], playerStats = {}, publicAwardsEnabled = false, publicScoutingEnabled = true) {
  return {
    updatedAt: new Date().toISOString(),
    standings: teams.map(team => ({ name: team, wins: standings[team] || 0 })).sort((a, b) => b.wins - a.wins),
    matches: history.map(match => ({
      teamA: match.teamA, teamB: match.teamB,
      setsWonA: match.setsWonA, setsWonB: match.setsWonB, winner: match.winner, isPractice: match.isPractice === true
    })),
    schedule: ((bracket && bracket.matches) || []).map(match => ({
      id: match.id, phase: match.phase, teamA: match.teamA, teamB: match.teamB,
      scheduledAt: match.scheduledAt, status: match.status, winner: match.winner,
      setsWonA: match.setsWonA, setsWonB: match.setsWonB, isPractice: match.isPractice === true
    })),
    scoutingPlayers: (roster || []).map(projectScoutingPlayer),
    publicAwardsEnabled: publicAwardsEnabled === true,
    publicScoutingEnabled: publicScoutingEnabled !== false,
    scoringPlayers: publicAwardsEnabled ? (roster || []).map(player => ({
      id: String(player.id || ''), name: String(player.name || ''), team: String(player.team || ''), gender: String(player.gender || ''),
      stats: Object.fromEntries(PUBLIC_STAT_KEYS.map(key => [key, Number(playerStats[player.id] && playerStats[player.id][key]) || 0]))
    })) : [],
    groups: bracket ? { groupA: bracket.groupA || [], groupB: bracket.groupB || [] } : { groupA: [], groupB: [] },
    liveMatch: current ? {
      teamA: current.teamA, teamB: current.teamB, scoreA: current.currentSet.a,
      scoreB: current.currentSet.b, setsWonA: current.setsWonA, setsWonB: current.setsWonB,
      setNumber: current.sets.length + 1
    } : null
  };
}

export async function publishSnapshot(eventName, eventBinId, registryId, teams, standings, history, bracket, current, roster = [], playerStats = {}, publicAwardsEnabled = false, publicScoutingEnabled = true) {
  const snapshot = buildPublicSnapshot(teams, standings, history, bracket, current, roster, playerStats, publicAwardsEnabled, publicScoutingEnabled);
  return backendJson('/api/tournament-public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName, eventBinId, registryId: registryId || DEFAULT_REGISTRY_ID, snapshot })
  });
}

async function syncRequest(body) {
  return backendJson('/api/tournament-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function activateSync(eventName, state) {
  const result = await syncRequest({ action: 'activate', eventName, state });
  return result.binId;
}

export async function pushCloud(binId, eventName, state) {
  try {
    await syncRequest({ action: 'push', binId, eventName, state });
    return true;
  } catch {
    return false;
  }
}

export async function pullCloud(binId) {
  const result = await syncRequest({ action: 'pull', binId });
  return result && result.record;
}

export async function importSyncedEvent(code) {
  const record = await pullCloud(code);
  if (!record || !record.state) throw new Error('Código não encontrado');
  return record;
}

export async function fetchRegistryList(registryId) {
  const query = new URLSearchParams({ registry: registryId });
  return backendJson('/api/tournament-public?' + query.toString());
}

export async function fetchPublicSnapshot(binId) {
  const query = new URLSearchParams({ tournament: binId });
  return backendJson('/api/tournament-public?' + query.toString());
}