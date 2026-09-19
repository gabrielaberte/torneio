// Camada de sincronização/publicação usando jsonbin.io (conta gratuita do usuário)
const BASE = 'https://api.jsonbin.io/v3/b';

async function jfetch(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.message) || ('HTTP ' + res.status));
  return data;
}

/** Garante que o torneio tenha um bin público (classificação). Retorna o id. */
export async function ensureEventBin(key, eventName, existingId) {
  if (existingId) return existingId;
  const data = await jfetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': key, 'X-Bin-Private': 'false', 'X-Bin-Name': eventName },
    body: JSON.stringify({ updatedAt: new Date().toISOString(), standings: [], matches: [], schedule: [] })
  });
  return data.metadata.id;
}

/** Garante que exista o índice global (lista de torneios publicados). Retorna o id. */
export async function ensureRegistry(key, existingId) {
  if (existingId) return existingId;
  const data = await jfetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': key, 'X-Bin-Private': 'false', 'X-Bin-Name': 'Índice de Torneios' },
    body: JSON.stringify({ tournaments: [] })
  });
  return data.metadata.id;
}

export async function updateRegistry(key, registryId, eventBinId, eventName) {
  let list = [];
  try {
    const data = await jfetch(BASE + '/' + registryId + '/latest');
    list = (data && data.record && data.record.tournaments) || [];
  } catch (e) { /* índice ainda vazio */ }
  const idx = list.findIndex(t => t.binId === eventBinId);
  const entry = { name: eventName, binId: eventBinId, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  await jfetch(BASE + '/' + registryId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
    body: JSON.stringify({ tournaments: list })
  });
}

/** Publica a classificação/resultados públicos deste torneio + atualiza o índice. */
export async function publishSnapshot(key, eventName, jsonbinId, registryId, teams, standings, history) {
  const snapshot = {
    updatedAt: new Date().toISOString(),
    standings: teams.map(t => ({ name: t, wins: standings[t] || 0 })).sort((a, b) => b.wins - a.wins),
    matches: history.map(m => ({ teamA: m.teamA, teamB: m.teamB, setsWonA: m.setsWonA, setsWonB: m.setsWonB, winner: m.winner })),
    schedule: []
  };
  const eventBinId = await ensureEventBin(key, eventName, jsonbinId);
  await jfetch(BASE + '/' + eventBinId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
    body: JSON.stringify(snapshot)
  });
  const regId = await ensureRegistry(key, registryId);
  await updateRegistry(key, regId, eventBinId, eventName);
  return { eventBinId, registryId: regId };
}

/** Cria (se preciso) e mantém o bin PRIVADO com o estado completo deste torneio. */
export async function activateSync(key, eventName, state) {
  const data = await jfetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': key, 'X-Bin-Private': 'true', 'X-Bin-Name': 'sync-' + eventName },
    body: JSON.stringify({ eventName, updatedAt: state.updatedAt, state })
  });
  return data.metadata.id;
}
export async function pushCloud(key, binId, eventName, state) {
  if (!key || !binId) return;
  try {
    await fetch(BASE + '/' + binId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
      body: JSON.stringify({ eventName, updatedAt: state.updatedAt, state })
    });
  } catch (e) { /* tenta de novo na próxima alteração */ }
}
export async function pullCloud(key, binId) {
  const data = await jfetch(BASE + '/' + binId + '/latest', { headers: { 'X-Master-Key': key } });
  return data && data.record;
}
export async function importSyncedEvent(key, code) {
  const record = await pullCloud(key, code);
  if (!record || !record.state) throw new Error('Código não encontrado');
  return record; // { eventName, updatedAt, state }
}

/* ---------- Leitura pública (app de visualização) ---------- */
export async function fetchRegistryList(registryId) {
  const data = await jfetch(BASE + '/' + registryId + '/latest');
  return (data && data.record && data.record.tournaments) || [];
}
export async function fetchPublicSnapshot(binId) {
  const data = await jfetch(BASE + '/' + binId + '/latest');
  return data && data.record;
}
