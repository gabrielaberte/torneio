import { useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_TYPES, emptyStats, uid } from '../lib/constants';
import {
  defaultState, loadEventState, saveEventState, getEvents, normalizeEventState,
  getRegistryId, setRegistryId, getViewerUrl,
  getPendingPublicationIds, markPublicationPending, clearPendingPublication,
  isSyncPending, markSyncPending, clearSyncPending
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
  const latestState = useRef(state);

  useEffect(() => { latestState.current = state; }, [state]);

  useEffect(() => {
    async function retryPendingSync() {
      if (!eventId || !navigator.onLine || !isSyncPending(eventId)) return;
      const current = loadedFor.current === eventId ? latestState.current : loadEventState(eventId);
      if (!current.sync || !current.sync.binId) return;
      const saved = await pushCloud(current.sync.binId, currentEventName(eventId), {
        ...current,
        updatedAt: new Date().toISOString()
      });
      if (saved) clearSyncPending(eventId);
      else markSyncPending(eventId);
    }
    window.addEventListener('online', retryPendingSync);
    if (navigator.onLine && isSyncPending(eventId)) retryPendingSync();
    return () => window.removeEventListener('online', retryPendingSync);
  }, [eventId, state.sync.binId]);

  // troca de torneio -> recarrega estado local e tenta puxar versÃ£o mais nova da nuvem
  useEffect(() => {
    loadedFor.current = eventId;
    const s = loadEventState(eventId);
    setState(s);
    (async () => {
      if (!s.sync.binId) return;
      try {
        const record = await pullCloud(s.sync.binId);
        if (record && record.state && (!s.updatedAt || new Date(record.updatedAt) > new Date(s.updatedAt))) {
          if (loadedFor.current === eventId) {
            setState(normalizeEventState(record.state));
            toast('ðŸ”„ Dados mais recentes da nuvem carregados');
          }
        }
      } catch (e) { /* offline ou nunca sincronizado, segue local */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    setPublicationPending(getPendingPublicationIds().includes(eventId));
    async function retryPendingPublication() {
      if (!navigator.onLine || !getPendingPublicationIds().includes(eventId)) return;
      const current = latestState.current;
      if (!current.jsonbin || !current.jsonbin.id) return;
      try {
        const currentTeams = Array.from(new Set([...(current.teamEntries || []), ...(current.roster || []).map(player => player.team)].filter(Boolean))).sort();
        const { eventBinId, registryId } = await cloudPublish(
          currentEventName(eventId), current.jsonbin.id, getRegistryId(), currentTeams,
          current.standings || {}, current.history || [], current.bracket, current.current, current.roster || [], current.playerStats || {}, current.publicAwardsEnabled === true
        );
        setRegistryId(registryId);
        update(s => { s.jsonbin = { id: eventBinId }; return s; });
        clearPendingPublication(eventId);
        setPublicationPending(false);
      } catch { /* mantém pendente para nova tentativa ou publicação manual */ }
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
    if (state.sync.binId && !navigator.onLine) markSyncPending(eventId);
    if (state.sync.binId && navigator.onLine) {
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        pushCloud(state.sync.binId, currentEventName(eventId), { ...state, updatedAt }).then(saved => {
          if (saved) clearSyncPending(eventId);
          else markSyncPending(eventId);
        });
      }, 4000);
    }
    return () => clearTimeout(syncTimer.current);
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
  function addPlayer(data) {
    update(s => {
      s.roster.push({
        id: uid(),
        team: '',
        ...data,
        registrationValid: typeof data.registrationValid === 'boolean' ? data.registrationValid : false
      });
      return s;
    });
  }
  function updatePlayer(id, changes) {
    update(s => {
      s.roster = s.roster.map(player => {
        if (player.id !== id) return player;
        const next = { ...player, ...changes };
        if (changes.scoutingHistory && typeof changes.scoutingHistory === 'object') {
          const previous = player.scoutingHistory || {};
          next.scoutingHistory = {
            ...previous,
            ...changes.scoutingHistory,
            awards: { ...(previous.awards || {}), ...(changes.scoutingHistory.awards || {}) },
            podiums: { ...(previous.podiums || {}), ...(changes.scoutingHistory.podiums || {}) }
          };
        }
        if (next.registrationValid === false) next.team = '';
        return next;
      });
      return s;
    });
  }
  async function resetTournament() {
    const freshState = defaultState();
    // Keep service links so this same tournament can continue to be published and synced.
    freshState.jsonbin = { ...(state.jsonbin || { id: '' }) };
    freshState.sync = { ...(state.sync || { binId: '' }) };
    latestState.current = freshState;
    update(freshState);
    clearPendingPublication(eventId);
    clearSyncPending(eventId);
    setPublicationPending(false);
    toast('Torneio limpo.');

    if (!freshState.jsonbin.id) return;
    if (!navigator.onLine) {
      markPublicationPending(eventId);
      setPublicationPending(true);
      toast('Torneio limpo neste aparelho. A publicação vazia ficará pendente até a internet voltar.');
      return;
    }
    try {
      const { eventBinId, registryId } = await cloudPublish(
        currentEventName(eventId), freshState.jsonbin.id, getRegistryId(),
        [], freshState.standings, freshState.history, freshState.bracket, null, freshState.roster, freshState.playerStats, false
      );
      setRegistryId(registryId);
      update(s => { s.jsonbin = { id: eventBinId }; return s; });
      toast('Torneio limpo e publicação pública atualizada.');
    } catch {
      markPublicationPending(eventId);
      setPublicationPending(true);
      toast('Torneio limpo neste aparelho. Não foi possível atualizar a publicação; publique novamente quando houver conexão.');
    }
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
  function renameTeam(currentName, nextName) {
    const cleanedName = String(nextName || '').trim();
    if (!cleanedName) { toast('Informe o novo nome do time.'); return false; }
    if (cleanedName !== currentName && teams.includes(cleanedName)) { toast('Já existe um time com esse nome.'); return false; }
    if (cleanedName === currentName) return true;
    const renamed = value => value === currentName ? cleanedName : value;
    const renameMatch = match => {
      if (!match) return;
      ['teamA', 'teamB', 'winner'].forEach(key => { if (match[key] === currentName) match[key] = cleanedName; });
      (match.log || []).forEach(entry => {
        if (entry.text === `Ponto coletivo: ${currentName}`) entry.text = `Ponto coletivo: ${cleanedName}`;
      });
    };
    update(s => {
      s.teamEntries = (s.teamEntries || []).map(renamed);
      s.roster = (s.roster || []).map(player => player.team === currentName ? { ...player, team: cleanedName } : player);
      if (Object.prototype.hasOwnProperty.call(s.standings || {}, currentName)) {
        s.standings[cleanedName] = s.standings[currentName];
        delete s.standings[currentName];
      }
      if (s.bracket) {
        ['groupA', 'groupB', 'groupTeams'].forEach(key => {
          if (Array.isArray(s.bracket[key])) s.bracket[key] = s.bracket[key].map(renamed);
        });
        (s.bracket.matches || []).forEach(renameMatch);
      }
      (s.history || []).forEach(renameMatch);
      if (s.current) {
        renameMatch(s.current);
        (s.current.undoStack || []).forEach(entry => renameMatch(entry.match));
      }
      return s;
    });
    toast('Nome do time atualizado.');
    return true;
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
        { id: uid(), progressionKey: 'upper1', phase: 'Upper R1', teamA: first.name, teamB: pick.name, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), progressionKey: 'upper2', phase: 'Upper R1', teamA: second.name, teamB: other.name, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), progressionKey: 'upperFinal', phase: 'Upper Final', teamA: 'Vencedor Upper 1', teamB: 'Vencedor Upper 2', teamAFrom: { key: 'upper1', result: 'winner' }, teamBFrom: { key: 'upper2', result: 'winner' }, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), progressionKey: 'lower1', phase: 'Lower R1', teamA: sixth.name, teamB: 'Perdedor Upper 1', teamBFrom: { key: 'upper1', result: 'loser' }, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), progressionKey: 'lower2', phase: 'Lower R1', teamA: fifth.name, teamB: 'Perdedor Upper 2', teamBFrom: { key: 'upper2', result: 'loser' }, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), progressionKey: 'lowerR2', phase: 'Lower R2', teamA: 'Vencedor Lower 1', teamB: 'Vencedor Lower 2', teamAFrom: { key: 'lower1', result: 'winner' }, teamBFrom: { key: 'lower2', result: 'winner' }, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), progressionKey: 'lowerFinal', phase: 'Lower Final', teamA: 'Vencedor Lower R2', teamB: 'Perdedor Upper Final', teamAFrom: { key: 'lowerR2', result: 'winner' }, teamBFrom: { key: 'upperFinal', result: 'loser' }, scheduledAt: '', status: 'scheduled', bestOf: 3 },
        { id: uid(), progressionKey: 'grandFinal', phase: 'Grande Final', teamA: 'Vencedor Upper Final', teamB: 'Vencedor Lower Final', teamAFrom: { key: 'upperFinal', result: 'winner' }, teamBFrom: { key: 'lowerFinal', result: 'winner' }, scheduledAt: '', status: 'scheduled', bestOf: 3 }
      ];
      s.bracket.matches.push(...elimination); return s;
    });
  }
  function updateBracketMatch(id, changes) {
    update(s => {
      const bracket = s.bracket || { groupA: [], groupB: [], matches: [] };
      bracket.matches = bracket.matches.map(match => match.id === id && match.status !== 'done' ? { ...match, ...changes } : match);
      s.bracket = bracket;
      return s;
    });
  }
  function moveBracketMatch(id, direction) {
    update(s => {
      const bracket = s.bracket || { groupA: [], groupB: [], matches: [] };
      const index = bracket.matches.findIndex(match => match.id === id);
      const target = index + direction;
      if (index >= 0 && target >= 0 && target < bracket.matches.length && bracket.matches[index].status !== 'done' && bracket.matches[target].status !== 'done') {
        [bracket.matches[index], bracket.matches[target]] = [bracket.matches[target], bracket.matches[index]];
      }
      s.bracket = bracket;
      return s;
    });
  }

  function undoBracketMatchResult(id, removeMatch = false) {
    update(s => {
      if (!s.bracket || !Array.isArray(s.bracket.matches)) return s;
      const matches = s.bracket.matches;
      resolveBracketProgression(matches);
      const target = matches.find(match => match.id === id);
      if (!target || target.status !== 'done') return s;

      const affectedKeys = new Set(target.progressionKey ? [target.progressionKey] : []);
      const affectedIds = new Set([target.id]);
      const isGroupPhase = /grupo|fase de grupos/i.test(target.phase || '');
      if (isGroupPhase) {
        matches.filter(match => !/grupo|fase de grupos/i.test(match.phase || '')).forEach(match => {
          affectedIds.add(match.id);
          if (match.progressionKey) affectedKeys.add(match.progressionKey);
        });
      }
      let expanded = true;
      while (expanded) {
        expanded = false;
        matches.forEach(match => {
          if (affectedIds.has(match.id)) return;
          const dependsOnAffected = ['teamAFrom', 'teamBFrom'].some(ref => match[ref] && affectedKeys.has(match[ref].key));
          if (!dependsOnAffected) return;
          affectedIds.add(match.id);
          if (match.progressionKey) affectedKeys.add(match.progressionKey);
          expanded = true;
        });
      }

      const revertResult = match => {
        if (!match || !match.winner) return;
        s.standings[match.winner] = Math.max(0, (s.standings[match.winner] || 0) - 1);
        let historyIndex = -1;
        for (let i = s.history.length - 1; i >= 0; i -= 1) {
          const item = s.history[i];
          const sameMatch = item.bracketMatchId
            ? item.bracketMatchId === match.id
            : item.teamA === match.teamA && item.teamB === match.teamB && item.winner === match.winner;
          if (sameMatch) { historyIndex = i; break; }
        }
        if (historyIndex < 0) return;
        const [historyItem] = s.history.splice(historyIndex, 1);
        Object.entries(historyItem.matchStats || {}).forEach(([playerId, stats]) => {
          const playerStats = s.playerStats[playerId];
          if (!playerStats) return;
          Object.entries(stats).forEach(([key, value]) => {
            playerStats[key] = Math.max(0, (playerStats[key] || 0) - (Number(value) || 0));
          });
        });
        const mvp = historyItem.mvpId
          ? s.roster.find(player => player.id === historyItem.mvpId)
          : s.roster.find(player => player.name === historyItem.mvpName);
        if (mvp && s.playerStats[mvp.id]) s.playerStats[mvp.id].mvp = Math.max(0, (s.playerStats[mvp.id].mvp || 0) - 1);
      };

      matches.forEach(match => {
        if (!affectedIds.has(match.id)) return;
        if (match.status === 'done') revertResult(match);
        match.status = 'scheduled';
        delete match.winner;
        delete match.setsWonA;
        delete match.setsWonB;
        delete match.sets;
      });
      if (s.current && affectedIds.has(s.current.bracketMatchId)) s.current = null;
      if ([...affectedIds].some(matchId => {
        const affected = matches.find(match => match.id === matchId);
        return affected && ['Final', 'Grande Final'].includes(affected.phase);
      })) s.publicAwardsEnabled = false;
      if (isGroupPhase) {
        s.bracket.matches = matches.filter(match => /grupo|fase de grupos/i.test(match.phase || '') && (!removeMatch || match.id !== id));
      } else if (removeMatch) {
        s.bracket.matches = matches.filter(match => match.id !== id);
      }
      resolveBracketProgression(s.bracket.matches);
      return s;
    });
    toast(removeMatch ? 'Partida excluída. Publique novamente para atualizar a visão pública.' : 'Resultado removido. Publique novamente para atualizar a visão pública.');
  }

  function deleteBracketMatch(id) { undoBracketMatchResult(id, true); }

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
      s.history.push({ bracketMatchId: m.bracketMatchId || null, mvpId, matchStats: m.matchStats, teamA: m.teamA, teamB: m.teamB, sets: m.sets, setsWonA: m.setsWonA, setsWonB: m.setsWonB, winner: m.winner, mvpName });
      if (m.bracketMatchId && s.bracket && s.bracket.matches) {
        s.bracket.matches = s.bracket.matches.map(match => match.id === m.bracketMatchId
          ? { ...match, status: 'done', winner: m.winner, setsWonA: m.setsWonA, setsWonB: m.setsWonB, sets: m.sets }
          : match);
        resolveBracketProgression(s.bracket.matches);
      }
      s.current = null;
      return s;
    });
    toast('Partida salva!');
  }

  /* ---------- Nuvem: publicação pública + sincronização privada ---------- */
  async function publish(isAutomaticRetry = false) {
    if (!navigator.onLine) {
      markPublicationPending(eventId);
      setPublicationPending(true);
      if (!isAutomaticRetry) toast('Sem internet: publicação pendente até a conexão voltar.');
      return;
    }
    try {
      const { eventBinId, registryId } = await cloudPublish(
        currentEventName(eventId), state.jsonbin.id, getRegistryId(),
        teams, state.standings, state.history, state.bracket, state.current, state.roster, state.playerStats, state.publicAwardsEnabled === true
      );
      setRegistryId(registryId);
      update(s => { s.jsonbin = { id: eventBinId }; return s; });
      clearPendingPublication(eventId);
      setPublicationPending(false);
      toast('Placar publicado! Quem tiver o link fixo já vê este torneio na lista.');
    } catch {
      markPublicationPending(eventId);
      setPublicationPending(true);
      toast('Não foi possível publicar. Entre no acesso administrativo e confira a conexão.');
    }
  }

  async function publishFinalAwards() {
    const finalFinished = (state.bracket && state.bracket.matches || []).some(match =>
      ['Final', 'Grande Final'].includes(match.phase) && match.status === 'done' && match.winner
    );
    if (!finalFinished) { toast('Finalize a partida final antes de publicar as premiações.'); return; }
    if (!navigator.onLine) {
      update(s => { s.publicAwardsEnabled = true; return s; });
      markPublicationPending(eventId);
      setPublicationPending(true);
      toast('Premiações marcadas para publicação quando a internet voltar.');
      return;
    }
    try {
      const { eventBinId, registryId } = await cloudPublish(
        currentEventName(eventId), state.jsonbin.id, getRegistryId(), teams,
        state.standings, state.history, state.bracket, state.current, state.roster, state.playerStats, true
      );
      setRegistryId(registryId);
      update(s => { s.publicAwardsEnabled = true; s.jsonbin = { id: eventBinId }; return s; });
      clearPendingPublication(eventId);
      setPublicationPending(false);
      toast('Tabela de pontuação e premiações publicadas na visão pública.');
    } catch {
      markPublicationPending(eventId);
      setPublicationPending(true);
      toast('Não foi possível publicar as premiações. Tente novamente quando a conexão estiver disponível.');
    }
  }

  async function activateSync() {
    try {
      const binId = await cloudActivateSync(currentEventName(eventId), state);
      update(s => { s.sync = { binId }; return s; });
      toast('Sincronização ativada! Copie o código para usar em outro aparelho.');
    } catch {
      toast('Erro ao ativar sincronização. Entre no acesso administrativo e confira a conexão.');
    }
  }

  async function pushNow() {
    if (!state.sync.binId) { toast('Ative a sincronização primeiro'); return; }
    const saved = await pushCloud(state.sync.binId, currentEventName(eventId), {
      ...state,
      updatedAt: new Date().toISOString()
    });
    if (saved) clearSyncPending(eventId);
    else markSyncPending(eventId);
    toast(saved ? 'Sincronizado com a nuvem' : 'Falha ao sincronizar. Entre no acesso administrativo e tente novamente.');
  }

  function exportBackup() {
    return JSON.stringify({ eventName: currentEventName(eventId), state });
  }
  function importBackup(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.state) throw new Error('invÃ¡lido');
      setState(normalizeEventState(parsed.state));
      toast('Backup restaurado!');
    } catch (e) {
      toast('Backup invÃ¡lido.');
    }
  }

  function setModal(modal) { update(s => { s.modal = modal; return s; }); }

  return {
    state, teams, eligibleTeams, playersOfTeam, getStats, playerName, isTeamEligible,
    addPlayer, updatePlayer, deletePlayer, applyPlayerImport, resetTournament, addTeam, renameTeam, deleteTeam, assignPlayerToTeam,
    saveGroups, generateBracket, generateGroupPhase, generateDoubleElimination, groupStandings, updateBracketMatch, moveBracketMatch, undoBracketMatchResult, deleteBracketMatch,
    startMatch, cancelMatch, registerEvent, registerTeamPoint, chooseReceiver, undoLastPoint, finalizeMatch,
    publish, publishFinalAwards, publicationPending, activateSync, pushNow,
    exportBackup, importBackup,
    setModal
  };
}

function resolveBracketProgression(matches) {
  // Backfill metadata for brackets generated before progression was added.
  const phaseSlots = [
    ['Upper R1', ['upper1', 'upper2']],
    ['Upper Final', ['upperFinal']],
    ['Lower R1', ['lower1', 'lower2']],
    ['Lower R2', ['lowerR2']],
    ['Lower Final', ['lowerFinal']],
    ['Grande Final', ['grandFinal']]
  ];
  phaseSlots.forEach(([phase, keys]) => {
    matches.filter(match => match.phase === phase).forEach((match, index) => {
      if (!match.progressionKey && keys[index]) match.progressionKey = keys[index];
    });
  });
  const dependencies = {
    upperFinal: { teamAFrom: { key: 'upper1', result: 'winner' }, teamBFrom: { key: 'upper2', result: 'winner' } },
    lower1: { teamBFrom: { key: 'upper1', result: 'loser' } },
    lower2: { teamBFrom: { key: 'upper2', result: 'loser' } },
    lowerR2: { teamAFrom: { key: 'lower1', result: 'winner' }, teamBFrom: { key: 'lower2', result: 'winner' } },
    lowerFinal: { teamAFrom: { key: 'lowerR2', result: 'winner' }, teamBFrom: { key: 'upperFinal', result: 'loser' } },
    grandFinal: { teamAFrom: { key: 'upperFinal', result: 'winner' }, teamBFrom: { key: 'lowerFinal', result: 'winner' } }
  };
  const seeds = {
    upperFinal: { teamASeed: 'Vencedor Upper 1', teamBSeed: 'Vencedor Upper 2' },
    lower1: { teamBSeed: 'Perdedor Upper 1' },
    lower2: { teamBSeed: 'Perdedor Upper 2' },
    lowerR2: { teamASeed: 'Vencedor Lower 1', teamBSeed: 'Vencedor Lower 2' },
    lowerFinal: { teamASeed: 'Vencedor Lower R2', teamBSeed: 'Perdedor Upper Final' },
    grandFinal: { teamASeed: 'Vencedor Upper Final', teamBSeed: 'Vencedor Lower Final' }
  };
  matches.forEach(match => {
    Object.entries(dependencies[match.progressionKey] || {}).forEach(([side, source]) => {
      if (!match[side]) match[side] = source;
    });
    Object.entries(seeds[match.progressionKey] || {}).forEach(([side, seed]) => {
      if (!match[side]) match[side] = seed;
    });
  });
  const byKey = new Map(matches.filter(match => match.progressionKey).map(match => [match.progressionKey, match]));
  // Repeat to resolve chains in the same update, independent of match display order.
  for (let pass = 0; pass < matches.length; pass += 1) {
    matches.forEach(match => {
      ['teamA', 'teamB'].forEach(side => {
        const sourceRef = match[`${side}From`];
        const source = sourceRef && byKey.get(sourceRef.key);
        if (!source || source.status !== 'done' || !source.winner) {
          if (match.status !== 'done' && match[`${side}Seed`]) match[side] = match[`${side}Seed`];
          return;
        }
        const loser = source.teamA === source.winner ? source.teamB : source.teamA;
        match[side] = sourceRef.result === 'winner' ? source.winner : loser;
      });
    });
  }
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










