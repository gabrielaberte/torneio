import React, { useEffect, useRef, useState } from 'react';
import { fetchRegistryList, fetchPublicSnapshot } from '../../lib/cloud';

function useRegistryId() {
  const [id] = useState(() => new URLSearchParams(window.location.search).get('registry'));
  return id;
}

export default function PublicViewer({ onSwitchRole }) {
  const registryId = useRegistryId();
  const [screen, setScreen] = useState('list'); // 'list' | 'tournament'
  const [tab, setTab] = useState('times');
  const [tournaments, setTournaments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const pollTimer = useRef(null);

  useEffect(() => {
    if (!registryId) return;
    let alive = true;
    async function load() {
      try {
        const list = await fetchRegistryList(registryId);
        if (alive) setTournaments(list);
      } catch (e) { /* mantém a última lista */ }
    }
    load();
    const timer = setInterval(load, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [registryId]);

  useEffect(() => {
    if (screen !== 'tournament' || !selected) return;
    let alive = true;
    async function load() {
      try {
        const record = await fetchPublicSnapshot(selected.binId);
        if (alive && record) setSnapshot(record);
      } catch (e) { /* mantém o último placar */ }
    }
    load();
    pollTimer.current = setInterval(load, 15000);
    return () => { alive = false; clearInterval(pollTimer.current); };
  }, [screen, selected]);

  function openTournament(t) {
    setSelected(t); setSnapshot(null); setScreen('tournament'); setTab('times');
  }
  function goBack() {
    setScreen('list'); setSelected(null); setSnapshot(null);
  }

  const title = screen === 'tournament' && selected ? selected.name : 'Torneios de Vôlei';
  const sub = screen === 'tournament' ? 'toque para voltar à lista ←' : 'escolha um torneio para acompanhar';

  return (
    <>
      <div className="topbar">
        <div className="brand"><div className="ball" /><h1>{title}</h1></div>
        <div className="sub" onClick={screen === 'tournament' ? goBack : undefined}>{sub}</div>
      </div>
      {screen === 'tournament' ? (
        <>
          <div className="tabs">
            <button type="button" className={`tab ${tab === 'times' ? 'active' : ''}`} onClick={() => setTab('times')}>Classificação</button>
            <button type="button" className={`tab ${tab === 'jogos' ? 'active' : ''}`} onClick={() => setTab('jogos')}>Próximos jogos</button>
            <button type="button" className={`tab ${tab === 'scouting' ? 'active' : ''}`} onClick={() => setTab('scouting')}>Scouting</button>
          </div>
          <div className="content">
            {tab === 'times' ? <StandingsView snapshot={snapshot} /> : tab === 'jogos' ? <ScheduleView snapshot={snapshot} /> : <ScoutingView snapshot={snapshot} />}
          </div>
        </>
      ) : (
        <div className="content">
          <ListView registryId={registryId} tournaments={tournaments} onOpen={openTournament} />
        </div>
      )}
      <div className="content" style={{ paddingTop: 0 }}>
        <button className="btn btn-ghost btn-block" onClick={onSwitchRole}>Sou organizador(a) →</button>
      </div>
    </>
  );
}

function ListView({ registryId, tournaments, onOpen }) {
  if (!registryId) {
    return <div className="empty"><div className="big">🔗</div>Nenhum torneio conectado a este link ainda.</div>;
  }
  if (tournaments.length === 0) {
    return <div className="empty"><div className="big">🏐</div>Nenhum torneio publicado ainda.<br />Volte a checar em instantes.</div>;
  }
  const sorted = [...tournaments].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return sorted.map(t => (
    <div key={t.binId} className="card clickable" onClick={() => onOpen(t)}>
      <div>
        <div className="tourn-name">{t.name}</div>
        <div className="muted">Atualizado em {new Date(t.updatedAt).toLocaleString('pt-BR')}</div>
      </div>
      <div className="chevron">›</div>
    </div>
  ));
}

function StandingsView({ snapshot }) {
  if (!snapshot || !snapshot.standings || snapshot.standings.length === 0) {
    return <div className="empty"><div className="big">🏐</div>Este torneio ainda não tem classificação publicada.</div>;
  }
  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Classificação geral</h3>
        {snapshot.standings.map((r, i) => (
          <div key={r.name} className="standing-row">
            <div className="pos">{i + 1}</div><div className="tname">{r.name}</div><div className="wins">{r.wins}</div>
          </div>
        ))}
      </div>
      <div className="updated">Atualizado em {new Date(snapshot.updatedAt).toLocaleString('pt-BR')}</div>
      {snapshot.matches && snapshot.matches.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Últimos resultados</h3>
          {[...snapshot.matches].reverse().slice(0, 8).map((m, i) => (
            <div key={i} className="match-row">{m.teamA} {m.setsWonA}×{m.setsWonB} {m.teamB} — <span className="win">{m.winner}</span></div>
          ))}
        </div>
      )}
    </>
  );
}

function ScheduleView({ snapshot }) {
  if (!snapshot || !snapshot.schedule || snapshot.schedule.length === 0) {
    return <div className="empty"><div className="big">📅</div>O chaveamento ainda não foi publicado.</div>;
  }
  const statusText = { scheduled: 'Agendado', live: 'Em andamento', done: 'Finalizado' };
  const live = snapshot.liveMatch;
  return (
    <>
      {live && (
        <div className="card" style={{ border: '2px solid #e85d04' }}>
          <div style={{ fontWeight: 800, color: '#e85d04', marginBottom: 6 }}>● PARTIDA EM ANDAMENTO · SET {live.setNumber}</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{live.teamA} {live.scoreA} × {live.scoreB} {live.teamB}</div>
          <div className="muted">Sets: {live.setsWonA} × {live.setsWonB}</div>
        </div>
      )}
      {snapshot.groups && (snapshot.groups.groupA.length || snapshot.groups.groupB.length) && (
        <div className="card">
          <h3>Grupos</h3>
          <div className="muted"><b>Grupo A:</b> {snapshot.groups.groupA.join(' · ')}</div>
          <div className="muted" style={{ marginTop: 6 }}><b>Grupo B:</b> {snapshot.groups.groupB.join(' · ')}</div>
        </div>
      )}
      {snapshot.schedule.map((match, index) => (
        <div className="card" key={match.id || index}>
          <div className="muted" style={{ fontWeight: 800 }}>{index + 1}. {match.phase}</div>
          <div style={{ fontWeight: 800, margin: '5px 0' }}>{match.teamA} × {match.teamB}</div>
          <div className="muted">{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString('pt-BR') : 'Horário a definir'} · {statusText[match.status] || statusText.scheduled}</div>
        </div>
      ))}
      <div className="updated">Atualizado em {new Date(snapshot.updatedAt).toLocaleString('pt-BR')}</div>
    </>
  );
  /* legacy placeholder */
  return <div className="empty"><div className="big">📅</div>A tabela de próximos jogos ainda está sendo preparada.<br />Em breve você vai ver aqui os horários e confrontos.</div>;
}

const AWARD_LABELS = [
  ['mvp', 'MVP'], ['bestServer', 'Melhor sacador'], ['bestDefense', 'Melhor defesa'],
  ['bestAttack', 'Melhor ataque'], ['topScorer', 'Maior pontuador'], ['bestBlocker', 'Melhor bloqueio']
];
const PODIUM_LABELS = [['first', '1º lugar'], ['second', '2º lugar'], ['third', '3º lugar']];

function ScoutingView({ snapshot }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const players = snapshot && Array.isArray(snapshot.scoutingPlayers) ? snapshot.scoutingPlayers : [];
  const teamNames = Array.from(new Set(players.map(player => String(player.team || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const hasUnassignedPlayers = players.some(player => !String(player.team || '').trim());
  const filtered = players.filter(player => {
    const awards = player.awards || {};
    const podiums = player.podiums || {};
    const hasAwards = Object.values(awards).some(value => Number.isInteger(value) && value > 0);
    const hasPodiums = Object.values(podiums).some(value => Number.isInteger(value) && value > 0);
    const matchesFilter = filter === 'all'
      || (filter === 'captains' && player.isCaptain)
      || (filter === 'podiums' && hasPodiums)
      || (filter === 'awards' && hasAwards);
    const playerTeam = String(player.team || '').trim();
    const matchesTeam = teamFilter === 'all'
      || (teamFilter === '__unassigned__' && !playerTeam)
      || (teamFilter.startsWith('team:') && playerTeam === teamFilter.slice(5));
    return matchesFilter && matchesTeam && String(player.name || '').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
  });

  if (!snapshot) return <div className="empty">Carregando dados de scouting…</div>;
  if (players.length === 0) return <div className="empty"><div className="big">🏐</div>Este torneio ainda não tem atletas publicados para scouting.</div>;

  const filters = [['all', 'Todos'], ['captains', 'Capitães'], ['podiums', 'Com pódios'], ['awards', 'Com premiações']];
  return (
    <>
      <label htmlFor="scouting-search">Buscar atleta</label>
      <input id="scouting-search" type="text" value={query} onChange={event => setQuery(event.target.value)} placeholder="Digite um nome" />
      <label htmlFor="scouting-team-filter">Filtrar por time</label>
      <select id="scouting-team-filter" value={teamFilter} onChange={event => setTeamFilter(event.target.value)}>
        <option value="all">Todos os times</option>
        {teamNames.map(team => <option value={`team:${team}`} key={team}>{team}</option>)}
        {hasUnassignedPlayers && <option value="__unassigned__">Sem time</option>}
      </select>
      <div className="scouting-filters" role="group" aria-label="Filtrar atletas">
        {filters.map(([value, label]) => <button type="button" key={value} className={`btn btn-sm ${filter === value ? 'btn-navy' : 'btn-ghost'}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      {filtered.length === 0 ? <div className="empty">Nenhum atleta encontrado com esses critérios.</div> : (
        <div className="scouting-grid">
          {filtered.map((player, index) => {
            const awards = AWARD_LABELS.filter(([key]) => Number.isInteger(player.awards && player.awards[key]) && player.awards[key] >= 0);
            const podiums = PODIUM_LABELS.filter(([key]) => Number.isInteger(player.podiums && player.podiums[key]) && player.podiums[key] >= 0);
            return (
              <article className={`scouting-card${player.potColor ? '' : ' scouting-card-no-pot'}`} style={player.potColor ? { backgroundColor: player.potColor } : undefined} key={`${player.name}-${index}`}>
                <div className="scouting-card-heading"><h3>{player.name || 'Atleta'}</h3>{player.isCaptain && <span className="scouting-captain">Capitão/ã</span>}</div>
                {String(player.team || '').trim() && <div className="scouting-team">{player.team}</div>}
                {podiums.length > 0 && <div className="scouting-section"><span className="scouting-section-title">Pódios</span><div className="scouting-counts">{podiums.map(([key, label]) => <span className="scouting-count" key={key}>{label} <b>{player.podiums[key]}</b></span>)}</div></div>}
                {awards.length > 0 && <div className="scouting-section"><span className="scouting-section-title">Premiações</span><div className="scouting-counts">{awards.map(([key, label]) => <span className="scouting-count" key={key}>{label} <b>{player.awards[key]}</b></span>)}</div></div>}
                {podiums.length === 0 && awards.length === 0 && <div className="scouting-no-history">Sem histórico registrado</div>}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
