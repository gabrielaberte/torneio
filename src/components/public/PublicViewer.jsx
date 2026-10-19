import React, { useEffect, useRef, useState } from 'react';
import { fetchRegistryList, fetchPublicSnapshot } from '../../lib/cloud';

function useRegistryId() {
  const [id] = useState(() => new URLSearchParams(window.location.search).get('registry'));
  return id;
}

function updateViewerUrl(registryId, tournamentId, tab) {
  const url = new URL(window.location.href);
  if (registryId) url.searchParams.set('registry', registryId);
  if (tournamentId) url.searchParams.set('tournament', tournamentId);
  else url.searchParams.delete('tournament');
  if (tab && tournamentId) url.searchParams.set('tab', tab);
  else url.searchParams.delete('tab');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function PublicViewer({ onSwitchRole }) {
  const registryId = useRegistryId();
  const [screen, setScreen] = useState(() => new URLSearchParams(window.location.search).has('tournament') ? 'tournament' : 'list');
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return ['times', 'equipes', 'jogos', 'scouting', 'premios'].includes(requested) ? requested : 'times';
  });
  const [tournaments, setTournaments] = useState([]);
  const [selected, setSelected] = useState(() => {
    const binId = new URLSearchParams(window.location.search).get('tournament');
    return binId ? { binId, name: 'Torneio' } : null;
  });
  const [snapshot, setSnapshot] = useState(null);
  const pollTimer = useRef(null);

  useEffect(() => {
    if (!registryId) return;
    let alive = true;
    async function load() {
      try {
        const list = await fetchRegistryList(registryId);
        if (alive) {
          setTournaments(list);
          const requestedId = new URLSearchParams(window.location.search).get('tournament');
          if (requestedId) setSelected(previous => list.find(item => item.binId === requestedId) || previous);
        }
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
    updateViewerUrl(registryId, t.binId, 'times');
  }
  function goBack() {
    setScreen('list'); setSelected(null); setSnapshot(null);
    updateViewerUrl(registryId, null, null);
  }
  function changeTab(nextTab) {
    setTab(nextTab);
    if (selected) updateViewerUrl(registryId, selected.binId, nextTab);
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
            <button type="button" className={`tab ${tab === 'times' ? 'active' : ''}`} onClick={() => changeTab('times')}>Classificação</button>
            <button type="button" className={`tab ${tab === 'equipes' ? 'active' : ''}`} onClick={() => changeTab('equipes')}>Times</button>
            <button type="button" className={`tab ${tab === 'jogos' ? 'active' : ''}`} onClick={() => changeTab('jogos')}>Próximos jogos</button>
            <button type="button" className={`tab ${tab === 'scouting' ? 'active' : ''}`} onClick={() => changeTab('scouting')}>Scouting</button>
            {snapshot && snapshot.publicAwardsEnabled && <button type="button" className={`tab ${tab === 'premios' ? 'active' : ''}`} onClick={() => changeTab('premios')}>Premiações</button>}
          </div>
          <div className="content">
            {tab === 'premios' ? <PublicAwardsView snapshot={snapshot} /> : tab === 'times' ? <StandingsView snapshot={snapshot} /> : tab === 'equipes' ? <PublicTeamsView snapshot={snapshot} /> : tab === 'jogos' ? <ScheduleView snapshot={snapshot} /> : <ScoutingView snapshot={snapshot} tournamentId={selected.binId} />}
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
        <div className="muted">Publicado em {new Date(t.updatedAt).toLocaleString('pt-BR')}</div>
      </div>
      <div className="chevron">›</div>
    </div>
  ));
}

export function StandingsView({ snapshot }) {
  if (!snapshot || !snapshot.standings || snapshot.standings.length === 0) {
    return <div className="empty"><div className="big">🏐</div>Este torneio ainda não tem classificação publicada.</div>;
  }
  const playoffMatches = (snapshot.schedule || []).filter(match => match.phase !== 'Fase de grupos');
  const grandFinal = playoffMatches.find(match => /grande final|^final$/i.test(match.phase || '') && match.status === 'done' && match.winner);
  const bronzeMatch = playoffMatches.find(match => /3.? lugar/i.test(match.phase || '') && match.status === 'done' && match.winner);
  const lowerFinal = playoffMatches.find(match => /lower final/i.test(match.phase || '') && match.status === 'done' && match.winner);
  const podium = grandFinal ? [
    { place: 1, team: grandFinal.winner, medal: '🥇', label: 'Campeão' },
    { place: 2, team: grandFinal.teamA === grandFinal.winner ? grandFinal.teamB : grandFinal.teamA, medal: '🥈', label: 'Vice-campeão' },
    { place: 3, team: bronzeMatch ? bronzeMatch.winner : lowerFinal ? (lowerFinal.teamA === lowerFinal.winner ? lowerFinal.teamB : lowerFinal.teamA) : '', medal: '🥉', label: '3º lugar' }
  ].filter(item => item.team) : [];
  return (
    <>
      {podium.length > 0 && <section className="public-podium-section" aria-label="Pódio final">
        <h2>🏆 Pódio final</h2>
        <div className="public-podium-grid">
          {podium.map(item => <article className={`public-podium-card place-${item.place}`} key={item.place}>
            <div className="public-podium-medal" aria-hidden="true">{item.medal}</div>
            <div className="public-podium-place">{item.label}</div>
            <h3>{item.team}</h3>
            <div className="public-podium-players">
              {(snapshot.scoutingPlayers || []).filter(player => String(player.team || '').trim() === item.team).map((player, index) => <span key={player.id || `${player.name}-${index}`}>{player.name}</span>)}
              {!(snapshot.scoutingPlayers || []).some(player => String(player.team || '').trim() === item.team) && <span className="muted">Atletas não publicados</span>}
            </div>
          </article>)}
        </div>
      </section>}
      <div className="card muted">A tabela abaixo mostra a contagem de vitórias registradas. Ela não representa a colocação final nem define quem avançou no mata-mata.</div>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Vitórias registradas</h3>
        {snapshot.standings.map((r, i) => (
          <div key={r.name} className="standing-row">
            <div className="pos">{i + 1}</div><div className="tname">{r.name}</div><div className="wins">{r.wins} vitórias</div>
          </div>
        ))}
      </div>
      {playoffMatches.length > 0 && <div className="card">
        <h3 style={{ marginBottom: 6 }}>Mata-mata · Dia 2</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Os confrontos e seus resultados mostram quem chegou à final.</div>
        {playoffMatches.map((match, index) => <div className="match-row" key={match.id || index}>
          <b>{match.phase}:</b> {match.teamA} {match.status === 'done' ? `${match.setsWonA ?? 0}×${match.setsWonB ?? 0}` : '×'} {match.teamB}
          {match.status === 'done' && match.winner
            ? <> · <span className="win">Vencedor: {match.winner}</span></>
            : <span className="muted"> · {match.status === 'live' ? 'Em andamento' : 'Agendado'}</span>}
        </div>)}
      </div>}
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

const PUBLIC_AWARD_CATEGORIES = [
  ['Maior pontuador geral', 'points', null], ['Maior pontuador masc.', 'points', 'M'], ['Maior pontuadora fem.', 'points', 'F'],
  ['Melhor saque geral', 'aces', null], ['Melhor saque masc.', 'aces', 'M'], ['Melhor saque fem.', 'aces', 'F'],
  ['Melhor ataque geral', 'attacksGood', null], ['Melhor ataque masc.', 'attacksGood', 'M'], ['Melhor ataque fem.', 'attacksGood', 'F'],
  ['Melhor bloqueio', 'blocks', null], ['Mais quinadas', 'mishits', null], ['Mais erros de saque', 'serveErrors', null], ['Mais toques na rede', 'netTouches', null]
];
const PUBLIC_STAT_COLUMNS = [
  ['points', 'Pts'], ['aces', 'Ace'], ['attacksGood', 'Atq✓'], ['attacksBad', 'Atq✗'], ['blocks', 'Blq'],
  ['netTouches', 'Rede'], ['serveErrors', 'Saq✗'], ['mishits', 'Quin'], ['drops', 'Larg'], ['mvp', 'MVP']
];
const PUBLIC_MEDALS = ['🥇', '🥈', '🥉'];

export function PublicAwardsView({ snapshot }) {
  if (!snapshot || !snapshot.publicAwardsEnabled) return <div className="empty">As premiações ainda não foram publicadas.</div>;
  const players = snapshot.scoringPlayers || [];
  const sortedPlayers = [...players].sort((a, b) => (b.stats.points || 0) - (a.stats.points || 0) || a.name.localeCompare(b.name, 'pt-BR'));
  return <>
    <div className="section-title">Tabela geral de pontuação</div>
    <div className="card"><div className="table-scroll"><table className="stat-table">
      <thead><tr><th>Atleta</th>{PUBLIC_STAT_COLUMNS.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
      <tbody>{sortedPlayers.map(player => <tr key={player.id}>
        <td>{player.name}<br /><span style={{ fontSize: 9, color: 'rgba(15,42,61,.5)' }}>{player.team}</span></td>
        {PUBLIC_STAT_COLUMNS.map(([key]) => <td key={key}>{player.stats[key] || 0}</td>)}
      </tr>)}</tbody>
    </table></div></div>
    <div className="section-title">Premiações por categoria</div>
    <div className="award-grid">{PUBLIC_AWARD_CATEGORIES.map(([title, statKey, gender]) => {
      const leaders = players.filter(player => (!gender || player.gender === gender) && (player.stats[statKey] || 0) > 0)
        .sort((a, b) => (b.stats[statKey] || 0) - (a.stats[statKey] || 0)).slice(0, 3);
      return <div className={`award-card${['mishits', 'serveErrors', 'netTouches'].includes(statKey) ? ' bad-award' : ''}`} key={title}>
        <div className="a-label">{title}</div>
        {leaders.length ? leaders.map((player, index) => <div className="a-row" key={player.id}>
          <span className="medal">{PUBLIC_MEDALS[index]}</span><span className="aname">{player.name}</span><span className="aval">{player.stats[statKey]}</span>
        </div>) : <div className="muted" style={{ fontSize: 12 }}>Sem dados</div>}
      </div>;
    })}</div>
    {snapshot.updatedAt && <div className="updated">Atualizado em {new Date(snapshot.updatedAt).toLocaleString('pt-BR')}</div>}
  </>;
}

export function ScheduleView({ snapshot }) {
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
      {snapshot.groups && (snapshot.groups.groupA.length > 0 || snapshot.groups.groupB.length > 0) && (
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

export function PublicTeamsView({ snapshot }) {
  if (!snapshot) return <div className="empty">Carregando times…</div>;
  const players = Array.isArray(snapshot.scoutingPlayers) ? snapshot.scoutingPlayers : [];
  const teams = [...new Set([
    ...((snapshot.standings || []).map(team => team.name)),
    ...players.map(player => String(player.team || '').trim()).filter(Boolean)
  ])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (teams.length === 0) return <div className="empty">Nenhum time publicado ainda.</div>;
  return <>
    <div className="teams-grid public-teams-grid">
      {teams.map(team => {
        const members = players.filter(player => String(player.team || '').trim() === team);
        return <article className="card team-summary-card" key={team}>
          <div className="team-summary-heading"><h3>{team}</h3></div>
          <div className="team-member-chips">
            {members.map(player => {
              const pot = SCOUTING_COLORS.findIndex(([color]) => color === player.potColor);
              return <span key={player.id || player.name} style={{ backgroundColor: player.potColor || '#f1f3f4' }}>{player.name}{pot >= 0 ? ` · P${pot}` : ''}</span>;
            })}
            {members.length === 0 && <span className="muted">Nenhum atleta selecionado</span>}
          </div>
          <div className="team-summary-footer"><span className={members.length === 6 ? 'team-ready' : 'team-not-ready'}>{members.length}/6 · {members.length === 6 ? 'Time completo' : 'Vagas disponíveis'}</span></div>
        </article>;
      })}
    </div>
    {snapshot.updatedAt && <div className="updated">Atualizado em {new Date(snapshot.updatedAt).toLocaleString('pt-BR')}</div>}
  </>;
}

const AWARD_LABELS = [
  ['mvp', 'MVP'], ['bestServer', 'Melhor sacador'], ['bestDefense', 'Melhor defesa'],
  ['bestAttack', 'Melhor ataque'], ['topScorer', 'Maior pontuador'], ['bestBlocker', 'Melhor bloqueio']
];
const PODIUM_LABELS = [['first', '🥇', '1º lugar'], ['second', '🥈', '2º lugar'], ['third', '🥉', '3º lugar']];
const SCOUTING_COLORS = [
  ['#d9e6f2', 'Azul'], ['#b9d9c8', 'Verde'], ['#f5dfa2', 'Amarelo'],
  ['#efc1a6', 'Laranja'], ['#d8c1e8', 'Roxo']
];

export function ScoutingView({ snapshot, tournamentId }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const storageKey = `volei_scouting_favorites_${tournamentId}`;
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
    catch { return []; }
  });
  const players = snapshot && Array.isArray(snapshot.scoutingPlayers) ? snapshot.scoutingPlayers : [];
  const playerKey = (player, index) => player.id || `${player.name || 'atleta'}-${index}`;
  const orderedPlayers = filter === 'all'
    ? [...players].sort((a, b) => {
        const colorRank = color => {
          const rank = SCOUTING_COLORS.findIndex(([value]) => value === color);
          return rank < 0 ? SCOUTING_COLORS.length : rank;
        };
        return colorRank(a.potColor) - colorRank(b.potColor);
      })
    : players;
  function toggleFavorite(id) {
    setFavorites(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }
  const teamNames = Array.from(new Set(players.map(player => String(player.team || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const hasUnassignedPlayers = players.some(player => !String(player.team || '').trim());
  const filtered = orderedPlayers.filter(player => {
    const awards = player.awards || {};
    const podiums = player.podiums || {};
    const hasAwards = Object.values(awards).some(value => Number.isInteger(value) && value > 0);
    const hasPodiums = Object.values(podiums).some(value => Number.isInteger(value) && value > 0);
    const matchesFilter = filter === 'all'
      || (filter === 'captains' && player.isCaptain)
      || (filter === 'podiums' && hasPodiums)
      || (filter === 'awards' && hasAwards)
      || filter === 'favorites'
      || filter === 'favorites-available';
    const playerTeam = String(player.team || '').trim();
    const matchesTeam = teamFilter === 'all'
      || (teamFilter === '__unassigned__' && !playerTeam)
      || (teamFilter.startsWith('team:') && playerTeam === teamFilter.slice(5));
    const matchesColor = colorFilter === 'all'
      || (colorFilter === '__none__' && !player.potColor)
      || player.potColor === colorFilter;
    const playerId = playerKey(player, players.indexOf(player));
    const matchesFavorites = filter !== 'favorites' || favorites.includes(playerId);
    const matchesFavoriteAvailable = filter !== 'favorites-available' || (favorites.includes(playerId) && !playerTeam && Boolean(player.potColor));
    return matchesFilter && matchesFavorites && matchesFavoriteAvailable && matchesTeam && matchesColor && String(player.name || '').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
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
      <label htmlFor="scouting-color-filter">Filtrar por cor do card</label>
      <select id="scouting-color-filter" value={colorFilter} onChange={event => setColorFilter(event.target.value)}>
        <option value="all">Todas as cores</option>
        {SCOUTING_COLORS.filter(([color]) => players.some(player => player.potColor === color)).map(([color, label]) => <option value={color} key={color}>{label}</option>)}
        {players.some(player => !player.potColor) && <option value="__none__">Sem cor</option>}
      </select>
      <div className="scouting-filters" role="group" aria-label="Filtrar atletas">
        {filters.map(([value, label]) => <button type="button" key={value} className={`btn btn-sm ${filter === value ? 'btn-navy' : 'btn-ghost'}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <div className="scouting-filters" role="group" aria-label="Favoritos">
        <button type="button" className={`btn btn-sm ${filter === 'favorites' ? 'btn-navy' : 'btn-ghost'}`} aria-pressed={filter === 'favorites'} onClick={() => setFilter('favorites')}>Meus favoritos ({favorites.length})</button>
        <button type="button" className={`btn btn-sm ${filter === 'favorites-available' ? 'btn-navy' : 'btn-ghost'}`} aria-pressed={filter === 'favorites-available'} onClick={() => setFilter('favorites-available')}>Favoritos sem time</button>
      </div>
      {filtered.length === 0 ? <div className="empty">Nenhum atleta encontrado com esses critérios.</div> : (
        <div className="scouting-grid">
          {filtered.map((player, index) => {
            const playerId = playerKey(player, players.indexOf(player));
            const isFavorite = favorites.includes(playerId);
            const awards = AWARD_LABELS.filter(([key]) => Number.isInteger(player.awards && player.awards[key]) && player.awards[key] >= 0);
            const podiums = PODIUM_LABELS.filter(([key]) => Number.isInteger(player.podiums && player.podiums[key]) && player.podiums[key] > 0);
            return (
              <article className={`scouting-card${player.potColor ? '' : ' scouting-card-no-pot'}`} style={player.potColor ? { backgroundColor: player.potColor } : undefined} key={playerId}>
                <div className="scouting-card-heading"><div className="scouting-avatar">{player.photo ? <img src={player.photo} alt="" loading="lazy" /> : <span aria-hidden="true">{String(player.name || 'A').trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span>}</div><div className="scouting-player-meta"><h3>{player.name || 'Atleta'}</h3>{player.isCaptain && <span className="scouting-captain">Capitão/ã</span>}</div><button type="button" className={`scouting-favorite${isFavorite ? ' active' : ''}`} aria-pressed={isFavorite} aria-label={isFavorite ? `Remover ${player.name} dos favoritos` : `Favoritar ${player.name}`} onClick={() => toggleFavorite(playerId)}>{isFavorite ? '★' : '☆'}</button></div>
                {String(player.team || '').trim()
                  ? <div className="scouting-team">Já associado ao time: {player.team}</div>
                  : player.potColor
                    ? <div className="scouting-available">Disponível para o draft</div>
                    : <div className="scouting-unavailable">Não disponível para o draft</div>}
                {podiums.length > 0 && <div className="scouting-section"><span className="scouting-section-title">Pódios</span><div className="scouting-counts">{podiums.map(([key, medal, label]) => <span className="scouting-count scouting-medal" key={key} title={label} aria-label={`${label}: ${player.podiums[key]}`}><span aria-hidden="true">{medal}</span>{player.podiums[key] > 1 && <b>×{player.podiums[key]}</b>}</span>)}</div></div>}
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
