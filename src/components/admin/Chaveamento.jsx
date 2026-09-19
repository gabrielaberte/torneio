import React, { useMemo, useState } from 'react';
import { useToast } from '../ui/Toast';

const STATUS = {
  scheduled: 'Agendado',
  live: 'Em andamento',
  done: 'Finalizado'
};

export default function Chaveamento({ t }) {
  const toast = useToast();
  const bracket = t.state.bracket || { groupA: [], groupB: [], matches: [] };
  const [groups, setGroups] = useState(() => initialGroups(t.teams, bracket));
  const groupsChanged = useMemo(
    () => [...groups.groupA, ...groups.groupB].join('|') !== [...bracket.groupA, ...bracket.groupB].join('|'),
    [groups, bracket]
  );

  if (t.teams.length < 6 || t.teams.length > 8) {
    return <div className="empty"><div className="big">🏐</div>Cadastre de 6 a 8 times no elenco para criar o chaveamento.</div>;
  }

  function assign(team, group) {
    setGroups(current => ({
      groupA: group === 'A' ? [...current.groupA, team] : current.groupA.filter(name => name !== team),
      groupB: group === 'B' ? [...current.groupB, team] : current.groupB.filter(name => name !== team)
    }));
  }
  function generate() {
    if (groups.groupA.length < 3 || groups.groupB.length < 3) {
      toast('Cada grupo precisa ter pelo menos 3 times.');
      return;
    }
    if (bracket.matches.length && !confirm('Gerar novamente apaga os horários e a ordem atuais. Continuar?')) return;
    t.generateBracket(groups.groupA, groups.groupB);
    toast('Chaveamento gerado. Cadastre os horários previstos abaixo.');
  }
  function saveGroups() {
    t.saveGroups(groups.groupA, groups.groupB);
    toast('Grupos salvos. Gere o chaveamento quando estiver pronto.');
  }

  return (
    <>
      <div className="card">
        <h3>Grupos da fase classificatória</h3>
        <div className="muted" style={{ marginBottom: 12 }}>Divida os times entre os grupos A e B. Cada grupo joga todos contra todos; os dois melhores de cada um avançam às semifinais.</div>
        {t.teams.map(team => {
          const value = groups.groupA.includes(team) ? 'A' : groups.groupB.includes(team) ? 'B' : '';
          return (
            <div className="player-row" key={team}>
              <div className="player-name">{team}</div>
              <select value={value} onChange={event => assign(team, event.target.value)} style={{ width: 110, margin: 0 }}>
                <option value="">Sem grupo</option><option value="A">Grupo A</option><option value="B">Grupo B</option>
              </select>
            </div>
          );
        })}
        <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={saveGroups} disabled={!groupsChanged}>Salvar grupos</button>
        <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={generate}>Gerar chaveamento</button>
      </div>

      {bracket.matches.length > 0 && (
        <>
          <div className="section-title">Agenda e confrontos</div>
          <div className="muted" style={{ marginBottom: 10 }}>Use as setas para alterar a ordem em caso de intercorrência.</div>
          {bracket.matches.map((match, index) => (
            <div className="card" key={match.id} style={{ marginBottom: 10 }}>
              <div className="muted" style={{ fontWeight: 800 }}>{index + 1}. {match.phase}</div>
              <div style={{ fontWeight: 800, margin: '5px 0 10px' }}>{match.teamA} × {match.teamB}</div>
              <label>Horário previsto</label>
              <input type="datetime-local" value={match.scheduledAt || ''} onChange={event => t.updateBracketMatch(match.id, { scheduledAt: event.target.value })} />
              <label>Status</label>
              <select value={match.status || 'scheduled'} onChange={event => t.updateBracketMatch(match.id, { status: event.target.value })}>
                {Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" disabled={index === 0} onClick={() => t.moveBracketMatch(match.id, -1)}>↑ Subir</button>
                <button className="btn btn-ghost" disabled={index === bracket.matches.length - 1} onClick={() => t.moveBracketMatch(match.id, 1)}>↓ Descer</button>
              </div>
            </div>
          ))}
          <button className="btn btn-navy btn-block" style={{ margin: '16px 0 20px' }} onClick={t.publish}>
            Atualizar chaveamento público
          </button>
        </>
      )}
    </>
  );
}

function initialGroups(teams, bracket) {
  if (bracket.groupA && bracket.groupA.length + bracket.groupB.length) {
    return { groupA: bracket.groupA.filter(team => teams.includes(team)), groupB: bracket.groupB.filter(team => teams.includes(team)) };
  }
  const split = Math.ceil(teams.length / 2);
  return { groupA: teams.slice(0, split), groupB: teams.slice(split) };
}
