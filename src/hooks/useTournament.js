import { useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_TYPES, emptyStats, uid } from '../lib/constants';
import {
  defaultState, loadEventState, saveEventState, getEvents,
  getJsonbinKey, getRegistryId, setRegistryId, getViewerUrl
} from '../lib/storage';
import { publishSnapshot as cloudPublish, activateSync as cloudActivateSync, pushCloud, pullCloud } from '../lib/cloud';
import { useToast } from '../components/ui/Toast';

export function useTournament(eventId) {
  const toast = useToast();
  const [state, setState] = useState(() => loadEventState(eventId));
  const syncTimer = useRef(null);
  const loadedFor = useRef(eventId);

  // troca de torneio -> recarrega estado local e tenta puxar versão mais nova da nuvem
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
            toast('🔄 Dados mais recentes da nuvem carregados');
          }
        }
      } catch (e) { /* offline ou nunca sincronizado, segue local */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // salva local sempre que o estado muda + agenda sincronização em nuvem (debounced)
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
    const set = new Set(state.roster.map(p => p.team).filter(Boolean));
    return Array.from(set).sort();
  }, [state.roster]);

  function playersOfTeam(team) {
    return state.roster.filter(p => p.team === team);
  }
  function getStats(id) {
    return state.playerStats[id] || emptyStats();
  }
  function playerName(id) {
    const p = state.roster.find(p => p.id === id);
    return p ? p.name : '—';
  }

  /* ---------- Elenco ---------- */
  function addPlayer({ name, team, gender }) {
    update(s => { s.roster.push({ id: uid(), name, team, gender }); return s; });
  }
  function deletePlayer(id) {
    update(s => {
      s.roster = s.roster.filter(p => p.id !== id);
      delete s.playerStats[id];
      return s;
    });
  }

  /* ---------- Jogo ao vivo ---------- */
  function startMatch({ teamA, teamB, bestOf, target }) {
    update(s => {
      s.current = { teamA, teamB, bestOf, target, sets: [], setsWonA: 0, setsWonB: 0, currentSet: { a: 0, b: 0 }, log: [], matchStats: {}, undoStack: [] };
      return s;
    });
  }
  function cancelMatch() {
    update(s => { s.current = null; return s; });
  }

  /** Registra um evento de ponto. Se for Ace, retorna {askReceiver:true, opponentTeam} pro componente abrir o próximo passo. */
  function registerEvent(evtKey, playerId, playerTeam) {
    let askReceiver = null;
    update(s => {
      const m = s.current;
      const ev = EVENT_TYPES[evtKey];
      const scoringTeam = ev.point === 'self' ? playerTeam : (playerTeam === m.teamA ? m.teamB : m.teamA);
      m.undoStack ||= [];

      // Guarda o estado do placar antes do lance. Isso também permite desfazer
      // o último ponto quando ele encerrou um set ou a partida.
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
      m.log.push({ text: `${player ? player.name : '—'}: ${ev.label}`, score: `${m.currentSet.a}-${m.currentSet.b}` });

      if (evtKey === 'ace') {
        askReceiver = playerTeam === m.teamA ? m.teamB : m.teamA;
        return s; // não fecha set ainda; espera a escolha do recebedor
      }
      checkSetEnd(s);
      return s;
    });
    return askReceiver ? { askReceiver } : {};
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
    toast('Último ponto removido e estatísticas atualizadas.');
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
      const mvpName = (s.roster.find(p => p.id === mvpId) || {}).name || '—';
      s.history.push({ teamA: m.teamA, teamB: m.teamB, sets: m.sets, setsWonA: m.setsWonA, setsWonB: m.setsWonB, winner: m.winner, mvpName });
      s.current = null;
      return s;
    });
    toast('Partida salva!');
  }

  /* ---------- Nuvem: publicação pública + sincronização privada ---------- */
  async function publish() {
    const key = getJsonbinKey();
    if (!key) { toast('Cole e salve sua Master Key primeiro (card "Conta jsonbin.io")'); return; }
    try {
      const { eventBinId, registryId } = await cloudPublish(
        key, currentEventName(eventId), state.jsonbin.id, getRegistryId(),
        teams, state.standings, state.history
      );
      setRegistryId(registryId);
      update(s => { s.jsonbin = { id: eventBinId }; return s; });
      toast('✅ Placar publicado! Quem tiver o link fixo já vê este torneio na lista.');
    } catch (e) {
      toast('Não foi possível publicar — confira sua conexão e a Master Key.');
    }
  }
  async function activateSync() {
    const key = getJsonbinKey();
    if (!key) { toast('Cole e salve sua Master Key primeiro'); return; }
    try {
      const binId = await cloudActivateSync(key, currentEventName(eventId), state);
      update(s => { s.sync = { binId }; return s; });
      toast('Sincronização ativada! Copie o código pra usar em outro aparelho.');
    } catch (e) {
      toast('Erro ao ativar sincronização: verifique a Master Key.');
    }
  }
  async function pushNow() {
    const key = getJsonbinKey();
    if (!key || !state.sync.binId) { toast('Ative a sincronização primeiro'); return; }
    await pushCloud(key, state.sync.binId, currentEventName(eventId), state);
    toast('✅ Sincronizado com a nuvem');
  }

  function exportBackup() {
    return JSON.stringify({ eventName: currentEventName(eventId), state });
  }
  function importBackup(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.state) throw new Error('inválido');
      setState(parsed.state);
      toast('Backup restaurado!');
    } catch (e) {
      toast('Backup inválido.');
    }
  }

  function setModal(modal) { update(s => { s.modal = modal; return s; }); }

  return {
    state, teams, playersOfTeam, getStats, playerName,
    addPlayer, deletePlayer,
    startMatch, cancelMatch, registerEvent, registerTeamPoint, chooseReceiver, undoLastPoint, finalizeMatch,
    publish, activateSync, pushNow,
    exportBackup, importBackup,
    setModal
  };
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
