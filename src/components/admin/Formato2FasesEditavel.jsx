import React from 'react';
import { useToast } from '../ui/Toast';

const STATUS_LABELS = { scheduled: 'Agendado', live: 'Em andamento', done: 'Finalizado' };

export default function Formato2Fases({ t }) {
  const toast = useToast();
  const bracket = t.state.bracket || { matches: [] };
  const matches = bracket.matches || [];
  const groups = matches.filter(match => match.phase === 'Fase de grupos');
  const knockout = matches.filter(match => match.phase !== 'Fase de grupos');

  if (t.eligibleTeams.length !== 6) {
    return <div className="empty">Este formato exige exatamente 6 times aptos, cada um com 6 inscrições válidas.</div>;
  }

  function generateGroups() {
    if (groups.length && !window.confirm('Refazer a fase de grupos apaga a agenda atual.')) return;
    t.generateGroupPhase();
    toast('Fase de grupos criada.');
  }

  return <>
    <div className="card">
      <h3>Dia 1 · Fase de grupos</h3>
      <div className="muted">Todos contra todos, melhor de 3. Vitória 2×0: 3 pts; vitória 2×1: 2 pts; derrota 1×2: 1 pt.</div>
      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={generateGroups}>Gerar jogos da fase de grupos</button>
    </div>

    {groups.length > 0 && <div className="card">
      <h3>Classificação</h3>
      {t.groupStandings.map(row => <div className="standing-row" key={row.name}>
        <div className="pos">{row.rank}</div><div className="tname">{row.name}</div><div className="wins">{row.points} pts · {row.wins}V · {row.pointDiff} saldo</div>
      </div>)}
    </div>}

    {groups.length > 0 && t.groupStandings.every(row => row.finished) && knockout.length === 0 && <div className="card">
      <h3>Dia 2 · Chave dupla</h3>
      <div className="muted">O 1º colocado escolhe enfrentar o 3º ou o 4º na Upper R1.</div>
      <button className="btn btn-navy btn-block" style={{ marginTop: 10 }} onClick={() => t.generateDoubleElimination(3)}>1º enfrenta o 3º</button>
      <button className="btn btn-navy btn-block" style={{ marginTop: 8 }} onClick={() => t.generateDoubleElimination(4)}>1º enfrenta o 4º</button>
    </div>}

    {matches.length > 0 && <>
      <div className="section-title">Jogos e ordem do chaveamento</div>
      <div className="muted" style={{ marginBottom: 10 }}>Edite os confrontos e horários. Use as setas para mudar a ordem, que também será usada na lista pública.</div>
      {matches.map((match, index) => {
        const locked = match.status === 'done' || match.status === 'live';
        const optionsFor = (current, opponent) => [...new Set([
          ...t.eligibleTeams.filter(team => team !== opponent),
          current
        ].filter(Boolean))];
        return <div className="card bracket-edit-card" key={match.id}>
          <div className="bracket-edit-heading"><b>{index + 1}. {match.phase}</b><span className="muted">{STATUS_LABELS[match.status] || STATUS_LABELS.scheduled}</span></div>
          <div className="bracket-edit-teams">
            <div><label htmlFor={`match-${match.id}-a`}>Time A</label><select id={`match-${match.id}-a`} value={match.teamA || ''} disabled={locked} onChange={event => t.updateBracketMatch(match.id, { teamA: event.target.value })}><option value="">Selecione um time</option>{optionsFor(match.teamA, match.teamB).map(team => <option key={team} value={team}>{team}</option>)}</select></div>
            <div><label htmlFor={`match-${match.id}-b`}>Time B</label><select id={`match-${match.id}-b`} value={match.teamB || ''} disabled={locked} onChange={event => t.updateBracketMatch(match.id, { teamB: event.target.value })}><option value="">Selecione um time</option>{optionsFor(match.teamB, match.teamA).map(team => <option key={team} value={team}>{team}</option>)}</select></div>
          </div>
          <div className="bracket-edit-meta">
            <div><label htmlFor={`match-${match.id}-time`}>Horário</label><input id={`match-${match.id}-time`} type="datetime-local" value={match.scheduledAt || ''} onChange={event => t.updateBracketMatch(match.id, { scheduledAt: event.target.value })} /></div>
            <div><label htmlFor={`match-${match.id}-bestof`}>Formato</label><select id={`match-${match.id}-bestof`} value={match.bestOf || 3} disabled={locked} onChange={event => t.updateBracketMatch(match.id, { bestOf: Number(event.target.value) })}><option value={3}>Melhor de 3</option><option value={5}>Melhor de 5</option></select></div>
          </div>
          {locked && <div className="muted" style={{ marginTop: 7 }}>Confronto bloqueado porque a partida já começou ou foi finalizada.</div>}
          <div className="bracket-edit-actions">
            <button className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => t.moveBracketMatch(match.id, -1)}>↑ Subir</button>
            <button className="btn btn-ghost btn-sm" disabled={index === matches.length - 1} onClick={() => t.moveBracketMatch(match.id, 1)}>↓ Descer</button>
          </div>
        </div>;
      })}
      <button className="btn btn-navy btn-block" style={{ margin: '12px 0 20px' }} onClick={t.publish}>Atualizar chaveamento público</button>
    </>}
  </>;
}
