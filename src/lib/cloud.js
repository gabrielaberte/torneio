const AWARD_KEYS = ['mvp', 'bestServer', 'bestDefense', 'bestAttack', 'topScorer', 'bestBlocker'];
const PODIUM_KEYS = ['first', 'second', 'third'];
const POT_COLORS = ['#d9e6f2', '#b9d9c8', '#f5dfa2', '#efc1a6', '#d8c1e8'];
const PUBLIC_STAT_KEYS = ['points', 'aces', 'attacksGood', 'attacksBad', 'blocks', 'netTouches', 'serveErrors', 'mishits', 'drops', 'mvp'];
const DEFAULT_REGISTRY_ID = '6ad30e27ffd5d1605372d8bd';

function projectCounts(source, allowedKeys) {
  const input = source && typeof source === 'object' ? source : {};
  return Object.fromEntries(allowedKeys
    .filter(key => Object.prototype.hasOwnProperty.call(input, key)
      && Number.isInteger(input[key]) && input[key] > 0)
    .map(key => [key, input[key]]));
}

export function projectScoutingPlayer(player) {
  const history = player.scoutingHistory || {};
  const projected = { id: String(player.id || ''), name: String(player.name || '') };
  if (player.team) projected.team = String(player.team);
  if (typeof player.photo === 'string' && player.photo) projected.photo = player.photo;
  if (player.isCaptain === true) projected.isCaptain = true;
  if (Number.isInteger(player.pot) && player.pot >= 0 && player.pot <= 4) projected.potColor = POT_COLORS[player.pot];
  const awards = projectCounts(history.awards, AWARD_KEYS);
  const podiums = projectCounts(history.podiums, PODIUM_KEYS);
  if (Object.keys(awards).length) projected.awards = awards;
  if (Object.keys(podiums).length) projected.podiums = podiums;
  return projected;
}

function projectPublicTeamPlayer(player) {
  const projected = { id: String(player.id || ''), name: String(player.name || '') };
  if (player.team) projected.team = String(player.team);
  if (Number.isInteger(player.pot) && player.pot >= 0 && player.pot <= 4) projected.potColor = POT_COLORS[player.pot];
  return projected;
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
  const officialWins = Object.fromEntries(teams.map(team => [team, 0]));
  history.filter(match => !match.isPractice && match.winner).forEach(match => {
    if (Object.prototype.hasOwnProperty.call(officialWins, match.winner)) officialWins[match.winner] += 1;
  });
  return {
    updatedAt: new Date().toISOString(),
    standings: teams.map(team => ({ name: team, wins: officialWins[team] })).sort((a, b) => b.wins - a.wins),
    matches: history.slice(-8).map(match => ({
      teamA: match.teamA, teamB: match.teamB,
      setsWonA: match.setsWonA, setsWonB: match.setsWonB, winner: match.winner,
      ...(match.isPractice ? { isPractice: true } : {})
    })),
    schedule: ((bracket && bracket.matches) || []).map(match => ({
      id: match.id, phase: match.phase, teamA: match.teamA, teamB: match.teamB,
      ...(match.scheduledAt ? { scheduledAt: match.scheduledAt } : {}), status: match.status,
      ...(match.winner ? { winner: match.winner } : {}),
      ...(match.setsWonA != null ? { setsWonA: match.setsWonA } : {}),
      ...(match.setsWonB != null ? { setsWonB: match.setsWonB } : {}),
      ...(match.isPractice ? { isPractice: true } : {})
    })),
    scoutingPlayers: (roster || []).map(publicScoutingEnabled ? projectScoutingPlayer : projectPublicTeamPlayer),
    publicAwardsEnabled: publicAwardsEnabled === true,
    publicScoutingEnabled: publicScoutingEnabled !== false,
    ...(publicAwardsEnabled ? { scoringPlayers: (roster || []).map(player => ({
      id: String(player.id || ''), name: String(player.name || ''), team: String(player.team || ''), gender: String(player.gender || ''),
      stats: Object.fromEntries(PUBLIC_STAT_KEYS.map(key => [key, Number(playerStats[player.id] && playerStats[player.id][key]) || 0]).filter(([, value]) => value > 0))
    })) } : {}),
    ...((bracket && ((bracket.groupA || []).length || (bracket.groupB || []).length)) ? { groups: { groupA: bracket.groupA || [], groupB: bracket.groupB || [] } } : {}),
    ...(current ? { liveMatch: {
      teamA: current.teamA, teamB: current.teamB, scoreA: current.currentSet.a,
      scoreB: current.currentSet.b, setsWonA: current.setsWonA, setsWonB: current.setsWonB,
      setNumber: current.sets.length + 1
    } } : {})
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

export async function fetchPublicSnapshot(binId, { fresh = false } = {}) {
  const query = new URLSearchParams({ tournament: binId });
  if (fresh) query.set('fresh', '1');
  return backendJson('/api/tournament-public?' + query.toString(), fresh ? { cache: 'no-store' } : {});
}