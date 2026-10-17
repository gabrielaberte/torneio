import { useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_TYPES, emptyStats, uid } from '../lib/constants';
import {
  defaultState, loadEventState, saveEventState, getEvents,
  getJsonbinKey, getRegistryId, setRegistryId, getViewerUrl,
  getPendingPublicationIds, markPublicationPending, clearPendingPublication
} from '../lib/storage';
import { publishSnapshot as cloudPublish, activateSync as cloudActivateSync, pushCloud, pullCloud } from '../lib/cloud';
import { useToast } from '../components/ui/Toast';
import { normalizePlayerName } from '../lib/playerImport';

export function useTournament(eventId) {
  const toast = useToast();
  const [state, setState] = useState(() => loadEventState(eventId));
  const [publicationPending, setPublicationPending] = useState(() => getPendingPublicationIds().includes(eventId));
  const syncTimer = useRef(null);
  const loadedFor = useRef(eventId);

  // troca de torneio -> recarrega estado local e tenta puxar versÃ£o mais nova da nuvem
  useEffect(() => {
    loadedFor.current = eventId;
    const s = loadEventState(eventId);
    setState(s);
    (async () => {
      const key = getJsonbinKey();
      if (!key || !s.sync.binId) return;
      try {
        const record = await pullCloud(key, s.sync.binId);
        if (record && record.state && (!s.updatedAt || new Date(record.updatedAt) > new Date(s.updatedAt))) {
          if (loadedFor.current === eventId) {
            setState(record.state);
            toast('ðŸ”„ Dados mais recentes da nuvem carregados');
          }
        }
      } catch (e) { /* offline ou nunca sincronizado, segue local */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    setPublicationPending(getPendingPublicationIds().includes(eventId));
    function retryPendingPublication() {
      if (getPendingPublicationIds().includes(eventId)) publish(true);
    }
    window.addEventListener('online', retryPendingPublication);
    if (navigator.onLine) retryPendingPublication();
    return () => window.removeEventListener('online', retryPendingPublication);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // salva local sempre que o estado muda + agenda sincronizaÃ§Ã£o em nuvem (debounced)
  useEffect(() => {
    if (!eventId) return;
    const updatedAt = saveEventState(eventId, state);
    const key = getJsonbinKey();
    if (state.sync.binId && key && navigator.onLine) {
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        pushCloud(key, state.sync.binId, currentEventName(eventId), { ...state, updatedAt });
      }, 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, eventId]);

  function update(fn) {
    setState(prev => {
      const next = typeof fn === 'function' ? fn(structuredClone(prev)) : fn;
      return next;
    });
  }

  const teams = useMemo(() => {
    const set = new Set([...(state.teamEntries || []), ...state.roster.map(p => p.team)].filter(Boolean));
    return Array.from(set).sort();
  }, [state.roster, state.teamEntries]);

  function isRegistrationValid(player) { return player.registrationValid !== false; }
  function isTeamEligible(team) {
    return state.roster.filter(player => player.team === team && isRegistrationValid(player)).length === 6;
  }
  const eligibleTeams = useMemo(() => teams.filter(isTeamEligible), [teams, state.roster]);

  function playersOfTeam(team) {
    return state.roster.filter(p => p.team === team);
  }
  function getStats(id) {
    return state.playerStats[id] || emptyStats();
  }
  function playerName(id) {
    const p = state.roster.find(p => p.id === id);
    return p ? p.name : 'â€”';
  }

  /* ---------- Elenco ---------- */
  function addPlayer({ name, gender, registrationValid = false }) {
    update(s => { s.roster.push({ id: uid(), name, team: '', gender, registrationValid }); return s; });
  }
  function updatePlayer(id, changes) {
    update(s => {
      s.roster = s.roster.map(player => {
        if (player.id !== id) return player;
        const next = { ...player, ...changes };
        if (next.registrationValid === false) next.team = '';
        return next;
      });
      return s;
    });
  }
  function deletePlayer(id) {
    update(s => {
      s.roster = s.roster.filter(p => p.id !== id);
      delete s.playerStats[id];
      return s;
    });
  }

  function applyPlayerImport(selections) {
    const roster = state.roster || [];
    const selected = selections.filter(item => item.record.valid && item.choice && item.choice.action !== 'skip');
    const nameCounts = new Map();
    selected.forEach(item => {
      const key = normalizePlayerName(item.record.data.name);
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    });

    let conflicts = selections.filter(item => item.record.valid && item.record.duplicate && (!item.choice || !item.choice.action)).length;
    conflicts += Array.from(nameCounts.values()).filter(count => count > 1).length;
    const operations = [];
    selected.forEach(item => {
      if (item.choice.action === 'add') operations.push({ type: 'add', id: uid(), data: item.record.data });
      else if (item.choice.action === 'merge') {
        const target = roster.find(player => player.id === item.choice.playerId);
        if (!target) conflicts += 1;
        else operations.push({ type: 'merge', playerId: target.id, data: item.record.data });
      } else conflicts += 1;
    });
    if (conflicts) return { inserted: 0, updated: 0, ignored: selections.length - selected.length, conflicts };

    if (!operations.length) return { inserted: 0, updated: 0, ignored: selections.length, conflicts: 0 };
    const inserted = operations.filter(operation => operation.type === 'add').length;
    const updated = operations.filter(operation => operation.type === 'merge').length;
    update(s => {
      operations.forEach(operation => {
        if (operation.type === 'add') {
          s.roster.push({ ...operation.data, id: operation.id, team: '' });
          return;
        }
        s.roster = s.roster.map(player => {
          if (player.id !== operation.playerId) return player;
          const incoming = operation.data;
          const next = { ...player, name: incoming.name, gender: incoming.gender, registrationValid: incoming.registrationValid };
          if (Object.prototype.hasOwnProperty.call(incoming, 'pot')) next.pot = incoming.pot;
          if (incoming.scoutingHistory) {
            const oldHistory = player.scoutingHistory || {};
            next.scoutingHistory = {
              ...oldHistory,
              ...incoming.scoutingHistory,
              awards: { ...(oldHistory.awards || {}), ...(incoming.scoutingHistory.awards || {}) },
              podiums: { ...(oldHistory.podiums || {}), ...(incoming.scoutingHistory.podiums || {}) }
            };
          }
          if (next.registrationValid === false) next.team = '';
          return next;
        });
      });
      return s;
    });
    return { inserted, updated, ignored: selections.length - selected.length, conflicts: 0 };
  }
  /* ---------- Jogo ao vivo ---------- */
  function startMatch({ teamA, teamB, bestOf, target, bracketMatchId = null }) {
    update(s => {
      s.current = { teamA, teamB, bestOf, target, bracketMatchId, sets: [], setsWonA: 0, setsWonB: 0, currentSet: { a: 0, b: 0 }, log: [], matchStats: {}, undoStack: [] };
      if (bracketMatchId && s.bracket && s.bracket.matches) {
        s.bracket.matches = s.bracket.matches.map(match => match.id === bracketMatchId ? { ...match, status: 'live' } : match);
      }
      return s;
    });
  }
  function cancelMatch() {
    update(s => {
      if (s.current && s.current.bracketMatchId && s.bracket && s.bracket.matches) {
        s.bracket.matches = s.bracket.matches.map(match => match.id === s.current.bracketMatchId ? { ...match, status: 'scheduled' } : match);
      }
      s.current = null;
      return s;
    });
  }

  /** Registra um evento de ponto. Se for Ace, retorna {askReceiver:true, opponentTeam} pro componente abrir o prÃ³ximo passo. */
  function registerEvent(evtKey, playerId, playerTeam) {
    let askReceiver = null;
    update(s => {
      const m = s.current;
      const ev = EVENT_TYPES[evtKey];
      const scoringTeam = ev.point === 'self' ? playerTeam : (playerTeam === m.teamA ? m.teamB : m.teamA);
      m.undoStack ||= [];

      // Guarda o estado do placar antes do lance. Isso tambÃ©m permite desfazer
      // o Ãºltimo ponto quando ele encerrou um set ou a partida.
      m.undoStack.push({
        match: snapshotMatch(m),
        playerId,
        stat: ev.stat,
        addsPoint: ev.point === 'self',
        receiverId: null
      });

      if (!s.playerStats[playerId]) s.playerStats[playerId] = emptyStats();
      if (!m.matchStats[playerId]) m.matchStats[playerId] = emptyStats();
      s.playerStats[playerId][ev.stat] += 1;
      m.matchStats[playerId][ev.stat] += 1;

      if (scoringTeam === m.teamA) m.currentSet.a += 1; else m.currentSet.b += 1;
      if (ev.point === 'self') {
        s.playerStats[playerId].points += 1;
        m.matchStats[playerId].points += 1;
      }

      const player = s.roster.find(p => p.id === playerId);
      m.log.push({ text: `${player ? player.name : 'â€”'}: ${ev.label}`, score: `${m.currentSet.a}-${m.currentSet.b}` });

      if (evtKey === 'ace') {
        askReceiver = playerTeam === m.teamA ? m.teamB : m.teamA;
        return s; // nÃ£o fecha set ainda; espera a escolha do recebedor
      }
      checkSetEnd(s);
      return s;
    });
    return askReceiver ? { askReceiver } : {};
  }
  function addTeam(name) {
    update(s => {
      const cleaned = name.trim();
      s.teamEntries ||= [];
      if (cleaned && !s.teamEntries.includes(cleaned)) s.teamEntries.push(cleaned);
      return s;
    });
  }
  function deleteTeam(name) {
    update(s => {
      s.teamEntries = (s.teamEntries || []).filter(team => team !== name);
      s.roster = s.roster.map(player => player.team === name ? { ...player, team: '' } : player);
      return s;
    });
  }
  function assignPlayerToTeam(playerId, team) {
    update(s => {
      const player = s.roster.find(item => item.id === playerId);
      if (!player || player.registrationValid === false) return s;
      const validPlayers = s.roster.filter(item => item.team === team && item.registrationValid !== false && item.id !== playerId);
      if (team && validPlayers.length >= 6) return s;
      player.team = team;
      return s;
    });
  }

  /* ---------- Chaveamento e agenda ---------- */
  function saveGroups(groupA, groupB) {
    update(s => {
      s.bracket = { ...(s.bracket || {}), groupA, groupB, matches: (s.bracket && s.bracket.matches) || [] };
      return s;
    });
  }
  function generateBracket(groupA, groupB) {
    update(s => {
      s.bracket = { groupA, groupB, matches: buildBracketMatches(groupA, groupB) };
      return s;
    });
  }
  function generateGroupPhase() {
    update(s => {
      const eligible = [...new Set(s.teamEntries || s.roster.map(p => p.team).filter(Boolean))].filter(team => s.roster.filter(p => p.team === team && p.registrationValid !== false).length === 6);
      if (eligible.length !== 6) return s;
      s.bracket = { groupTeams: eligible, matches: eligible.flatMap((a, i) => eligible.slice(i + 1).map(b => ({ id: uid(), phase: 'Fase de grupos', teamA: a, teamB: b, scheduledAt: '', status: 'scheduled', bestOf: 3 }))) };
      return s;
    });
  }
  const groupStandings = useMemo(() => calculateGroupStandings((state.bracket && state.bracket.groupTeams) || [], (state.bracket && state.bracket.matches) || []), [state.bracket]);
  function generateDoubleElimination(firstChoiceRank) {
    update(s => {
      const ranking = calculateGroupStandings((s.bracket && s.bracket.groupTeams) || [], (s.bracket && s.bracket.matches) || []);
      if (ranking.length !== 6 || ranking.some(row => !row.finished)) return s;
      const pick = ranking.find(row => row.rank === firstChoiceRank);
      const other = ranking.find(row => row.rank === (firstChoiceRank === 3 ? 4 : 3));
      const first = ranking[0], second = ranking[1], fifth = ranking[4], sixth = ranking[5];
      const elimination = [
        { id: uid(), phase: 'Upper R1', teamA: first.name, teamB: pick.name, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), phase: 'Upper R1', teamA: second.name, teamB: other.name, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), phase: 'Upper Final', teamA: 'Vencedor Upper 1', teamB: 'Vencedor Upper 2', scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), phase: 'Lower R1', teamA: sixth.name, teamB: 'Perdedor Upper 1', scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), phase: 'Lower R1', teamA: fifth.name, teamB: 'Perdedor Upper 2', scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), phase: 'Lower R2', teamA: 'Vencedor Lower 1', teamB: 'Vencedor Lower 2', scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), phase: 'Lower Final', teamA: 'Vencedor Lower R2', teamB: 'Perdedor Upper Final', scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), phase: 'Grande Final', teamA: 'Vencedor Upper Final', teamB: 'Vencedor Lower Final', scheduledAt: '', status: 'scheduled', bestOf: 3 }
      ];
      s.bracket.matches.push(...elimination); return s;
    });
  }
  function updateBracketMatch(id, changes) {
    update(s => {
      const bracket = s.bracket || { groupA: [], groupB: [], matches: [] };
      bracket.matches = bracket.matches.map(match => match.id === id ? { ...match, ...changes } : match);
      s.bracket = bracket;
      return s;
    });
  }
  function moveBracketMatch(id, direction) {
    update(s => {
      const bracket = s.bracket || { groupA: [], groupB: [], matches: [] };
      const index = bracket.matches.findIndex(match => match.id === id);
      const target = index + direction;
      if (index >= 0 && target >= 0 && target < bracket.matches.length) {
        [bracket.matches[index], bracket.matches[target]] = [bracket.matches[target], bracket.matches[index]];
      }
      s.bracket = bracket;
      return s;
    });
  }

  function registerTeamPoint(team) {
    update(s => {
      const m = s.current;
      m.undoStack ||= [];
      m.undoStack.push({
        match: snapshotMatch(m),
        playerId: null,
        stat: null,
        addsPoint: false,
        receiverId: null
      });

      if (team === m.teamA) m.currentSet.a += 1; else m.currentSet.b += 1;
      m.log.push({ text: `Ponto coletivo: ${team}`, score: `${m.currentSet.a}-${m.currentSet.b}` });
      checkSetEnd(s);
      return s;
    });
  }

  function chooseReceiver(receiverId) {
    update(s => {
      const m = s.current;
      if (receiverId) {
        if (!s.playerStats[receiverId]) s.playerStats[receiverId] = emptyStats();
        if (!m.matchStats[receiverId]) m.matchStats[receiverId] = emptyStats();
        s.playerStats[receiverId].mishits += 1;
        m.matchStats[receiverId].mishits += 1;
        const lastPoint = m.undoStack[m.undoStack.length - 1];
        if (lastPoint) lastPoint.receiverId = receiverId;
      }
      checkSetEnd(s);
      return s;
    });
  }

  function undoLastPoint() {
    if (!state.current || !state.current.undoStack || state.current.undoStack.length === 0) {
      toast('Nenhum ponto para voltar neste jogo.');
      return;
    }
    update(s => {
      const m = s.current;
      const lastPoint = m.undoStack.pop();

      if (lastPoint.playerId && lastPoint.stat) {
        decrementStat(s.playerStats[lastPoint.playerId], lastPoint.stat);
        decrementStat(m.matchStats[lastPoint.playerId], lastPoint.stat);
      }
      if (lastPoint.playerId && lastPoint.addsPoint) {
        decrementStat(s.playerStats[lastPoint.playerId], 'points');
        decrementStat(m.matchStats[lastPoint.playerId], 'points');
      }
      if (lastPoint.receiverId) {
        decrementStat(s.playerStats[lastPoint.receiverId], 'mishits');
        decrementStat(m.matchStats[lastPoint.receiverId], 'mishits');
      }

      Object.assign(m, lastPoint.match);
      return s;
    });
    toast('Ãšltimo ponto removido e estatÃ­sticas atualizadas.');
  }

  function checkSetEnd(s) {
    const m = s.current;
    if (!m) return;
    const setsToWin = Math.ceil(m.bestOf / 2);
    const target = m.target;
    const { a, b } = m.currentSet;
    const diff = Math.abs(a - b);
    if ((a >= target && diff >= 2) || (b >= target && diff >= 2)) {
      m.sets.push({ a, b });
      if (a > b) m.setsWonA += 1; else m.setsWonB += 1;
      m.currentSet = { a: 0, b: 0 };
      m.log = [];
      if (m.setsWonA >= setsToWin || m.setsWonB >= setsToWin) {
        m.winner = m.setsWonA > m.setsWonB ? m.teamA : m.teamB;
        m.finished = true;
      } else {
        toast(`Set finalizado: ${a}-${b}`);
      }
    }
  }

  function finalizeMatch(mvpId) {
    update(s => {
      const m = s.current;
      if (!s.playerStats[mvpId]) s.playerStats[mvpId] = emptyStats();
      s.playerStats[mvpId].mvp += 1;
      s.standings[m.winner] = (s.standings[m.winner] || 0) + 1;
      const mvpName = (s.roster.find(p => p.id === mvpId) || {}).name || 'â€”';
      s.history.push({ teamA: m.teamA, teamB: m.teamB, sets: m.sets, setsWonA: m.setsWonA, setsWonB: m.setsWonB, winner: m.winner, mvpName });
      if (m.bracketMatchId && s.bracket && s.bracket.matches) s.bracket.matches = s.bracket.matches.map(match => match.id === m.bracketMatchId ? { ...match, status: 'done', winner: m.winner, setsWonA: m.setsWonA, setsWonB: m.setsWonB, sets: m.sets } : match);
      if (m.bracketMatchId && s.bracket && s.bracket.matches) {
        s.bracket.matches = s.bracket.matches.map(match => match.id === m.bracketMatchId ? { ...match, status: 'done' } : match);
      }
      s.current = null;
      return s;
    });
    toast('Partida salva!');
  }

  /* ---------- Nuvem: publicaÃ§Ã£o pÃºblica + sincronizaÃ§Ã£o privada ---------- */
  async function publish(isAutomaticRetry = false) {
    const key = getJsonbinKey();
    if (!key) { toast('Cole e salve sua Master Key primeiro (card "Conta jsonbin.io")'); return; }
    if (!navigator.onLine) {
      markPublicationPending(eventId);
      setPublicationPending(true);
      if (!isAutomaticRetry) toast('Sem internet: publicaÃ§Ã£o pendente atÃ© a conexÃ£o voltar.');
      return;
    }
    try {
      const { eventBinId, registryId } = await cloudPublish(
        key, currentEventName(eventId), state.jsonbin.id, getRegistryId(),
        teams, state.standings, state.history, state.bracket, state.current
      );
      setRegistryId(registryId);
      update(s => { s.jsonbin = { id: eventBinId }; return s; });
      clearPendingPublication(eventId);
      setPublicationPending(false);
      toast('âœ… Placar publicado! Quem tiver o link fixo jÃ¡ vÃª este torneio na lista.');
    } catch (e) {
      markPublicationPending(eventId);
      setPublicationPending(true);
      toast('NÃ£o foi possÃ­vel publicar â€” confira sua conexÃ£o e a Master Key.');
    }
  }
  async function activateSync() {
    const key = getJsonbinKey();
    if (!key) { toast('Cole e salve sua Master Key primeiro'); return; }
    try {
      const binId = await cloudActivateSync(key, currentEventName(eventId), state);
      update(s => { s.sync = { binId }; return s; });
      toast('SincronizaÃ§Ã£o ativada! Copie o cÃ³digo pra usar em outro aparelho.');
    } catch (e) {
      toast('Erro ao ativar sincronizaÃ§Ã£o: verifique a Master Key.');
    }
  }
  async function pushNow() {
    const key = getJsonbinKey();
    if (!key || !state.sync.binId) { toast('Ative a sincronizaÃ§Ã£o primeiro'); return; }
    await pushCloud(key, state.sync.binId, currentEventName(eventId), state);
    toast('âœ… Sincronizado com a nuvem');
  }

  function exportBackup() {
    return JSON.stringify({ eventName: currentEventName(eventId), state });
  }
  function importBackup(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.state) throw new Error('invÃ¡lido');
      setState(parsed.state);
      toast('Backup restaurado!');
    } catch (e) {
      toast('Backup invÃ¡lido.');
    }
  }

  function setModal(modal) { update(s => { s.modal = modal; return s; }); }

  return {
    state, teams, eligibleTeams, playersOfTeam, getStats, playerName, isTeamEligible,
    addPlayer, updatePlayer, deletePlayer, applyPlayerImport, addTeam, deleteTeam, assignPlayerToTeam,
    saveGroups, generateBracket, generateGroupPhase, generateDoubleElimination, groupStandings, updateBracketMatch, moveBracketMatch,
    startMatch, cancelMatch, registerEvent, registerTeamPoint, chooseReceiver, undoLastPoint, finalizeMatch,
    publish, publicationPending, activateSync, pushNow,
    exportBackup, importBackup,
    setModal
  };
}

function buildBracketMatches(groupA, groupB) {
  const groupMatches = (teams, phase) => teams.flatMap((teamA, index) =>
    teams.slice(index + 1).map(teamB => ({ id: uid(), phase, teamA, teamB, scheduledAt: '', status: 'scheduled' }))
  );
  return [
    ...groupMatches(groupA, 'Grupo A'),
    ...groupMatches(groupB, 'Grupo B'),
    { id: uid(), phase: 'Semifinal 1', teamA: '1Âº Grupo A', teamB: '2Âº Grupo B', scheduledAt: '', status: 'scheduled' },
    { id: uid(), phase: 'Semifinal 2', teamA: '1Âº Grupo B', teamB: '2Âº Grupo A', scheduledAt: '', status: 'scheduled' },
    { id: uid(), phase: '3Âº lugar', teamA: 'Perdedor SF1', teamB: 'Perdedor SF2', scheduledAt: '', status: 'scheduled' },
    { id: uid(), phase: 'Final', teamA: 'Vencedor SF1', teamB: 'Vencedor SF2', scheduledAt: '', status: 'scheduled' }
  ];
}

function calculateGroupStandings(teams, matches) {
  const rows = Object.fromEntries(teams.map(name => [name, { name, points: 0, wins: 0, pointDiff: 0, head: {}, played: 0 }]));
  matches.filter(match => match.phase === 'Fase de grupos' && match.status === 'done' && match.winner).forEach(match => {
    const a = rows[match.teamA], b = rows[match.teamB]; if (!a || !b) return;
    const aWon = match.winner === match.teamA, loserSets = aWon ? match.setsWonB : match.setsWonA;
    const winner = aWon ? a : b, loser = aWon ? b : a;
    winner.points += loserSets === 0 ? 3 : 2; loser.points += loserSets === 1 ? 1 : 0; winner.wins += 1; a.played += 1; b.played += 1;
    (match.sets || []).forEach(set => { a.pointDiff += set.a - set.b; b.pointDiff += set.b - set.a; });
    winner.head[loser.name] = (winner.head[loser.name] || 0) + 1;
  });
  const allPlayed = matches.filter(match => match.phase === 'Fase de grupos').length;
  return Object.values(rows).sort((a, b) => b.points - a.points || b.wins - a.wins || (b.head[a.name] || 0) - (a.head[b.name] || 0) || b.pointDiff - a.pointDiff || a.name.localeCompare(b.name)).map((row, i) => ({ ...row, rank: i + 1, finished: row.played === teams.length - 1 && allPlayed > 0 }));
}

function snapshotMatch(match) {
  return {
    sets: structuredClone(match.sets),
    setsWonA: match.setsWonA,
    setsWonB: match.setsWonB,
    currentSet: structuredClone(match.currentSet),
    log: structuredClone(match.log),
    finished: Boolean(match.finished),
    winner: match.winner || null
  };
}

function decrementStat(stats, key) {
  if (stats && stats[key] > 0) stats[key] -= 1;
}

function currentEventName(eventId) {
  const ev = getEvents().find(e => e.id === eventId);
  return ev ? ev.name : 'Torneio';
}






