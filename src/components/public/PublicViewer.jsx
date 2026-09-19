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
            <div className={`tab ${tab === 'times' ? 'active' : ''}`} onClick={() => setTab('times')}>Classificação</div>
            <div className={`tab ${tab === 'jogos' ? 'active' : ''}`} onClick={() => setTab('jogos')}>Próximos jogos</div>
          </div>
          <div className="content">
            {tab === 'times' ? <StandingsView snapshot={snapshot} /> : <ScheduleView />}
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

function ScheduleView() {
  return <div className="empty"><div className="big">📅</div>A tabela de próximos jogos ainda está sendo preparada.<br />Em breve você vai ver aqui os horários e confrontos.</div>;
}
