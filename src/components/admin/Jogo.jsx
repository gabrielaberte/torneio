import React from 'react';

import { useState } from 'react';
import { EVENT_TYPES } from '../../lib/constants';
import { useToast } from '../ui/Toast';

export default function Jogo({ t }) {
  const toast = useToast();
  const [teamA, setTeamA] = useState(t.teams[0] || '');
  const [teamB, setTeamB] = useState(t.teams[1] || '');
  const [bestOf, setBestOf] = useState(3);
  const [targetSel, setTargetSel] = useState('25');
  const [customTarget, setCustomTarget] = useState('');
  const [modal, setModal] = useState(null); // null | 'pickType' | {step:'pickPlayer',evt} | {step:'pickReceiver',opponentTeam}
  const [mvpId, setMvpId] = useState('');

  const m = t.state.current;

  if (t.teams.length < 2) {
    return <div className="empty"><div className="big">🙋</div>Cadastre pelo menos 2 times na aba <b>Elenco</b> antes de iniciar um jogo.</div>;
  }

  if (!m) {
    return (
      <div className="card">
        <h3>Novo jogo</h3>
        <label>Time A</label>
        <select value={teamA} onChange={e => setTeamA(e.target.value)}>
          {t.teams.map(tm => <option key={tm} value={tm}>{tm}</option>)}
        </select>
        <label>Time B</label>
        <select value={teamB} onChange={e => setTeamB(e.target.value)}>
          {t.teams.map(tm => <option key={tm} value={tm}>{tm}</option>)}
        </select>
        <label>Melhor de</label>
        <select value={bestOf} onChange={e => setBestOf(parseInt(e.target.value, 10))}>
          <option value={3}>3 sets</option>
          <option value={1}>1 set</option>
          <option value={5}>5 sets</option>
        </select>
        <label>Pontos por set</label>
        <select value={targetSel} onChange={e => setTargetSel(e.target.value)}>
          <option value="15">15 pontos</option>
          <option value="21">21 pontos</option>
          <option value="25">25 pontos</option>
          <option value="custom">Outro valor…</option>
        </select>
        {targetSel === 'custom' && (
          <div style={{ marginTop: 8 }}>
            <input type="text" inputMode="numeric" placeholder="Ex: 12" value={customTarget} onChange={e => setCustomTarget(e.target.value)} />
          </div>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => {
          if (teamA === teamB) { toast('Escolha times diferentes'); return; }
          const target = targetSel === 'custom' ? parseInt(customTarget, 10) : parseInt(targetSel, 10);
          if (!target || target < 1) { toast('Informe um número válido de pontos por set'); return; }
          t.startMatch({ teamA, teamB, bestOf, target });
        }}>Iniciar jogo</button>
      </div>
    );
  }

  if (m.finished) {
    const allInMatch = t.state.roster.filter(p => p.team === m.teamA || p.team === m.teamB);
    const scorers = allInMatch.map(p => ({ id: p.id, name: p.name, pts: (m.matchStats[p.id] || {}).points || 0 })).sort((a, b) => b.pts - a.pts);
    const bestScorer = scorers[0];
    return (
      <div className="overlay">
        <div className="modal">
          <h3>🏐 Fim de jogo!</h3>
          <div className="modal-sub">{m.teamA} {m.setsWonA} × {m.setsWonB} {m.teamB} — vencedor: <b>{m.winner}</b></div>
          <div className="section-title">Maior pontuador da partida</div>
          <div className="card" style={{ marginBottom: 6 }}>
            {bestScorer && bestScorer.pts > 0 ? <><b>{bestScorer.name}</b> — {bestScorer.pts} pts</> : 'Sem pontos registrados'}
          </div>
          <div className="section-title">Escolha o MVP da partida</div>
          <select value={mvpId || (bestScorer && bestScorer.id) || ''} onChange={e => setMvpId(e.target.value)}>
            {allInMatch.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
          </select>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => {
            const id = mvpId || (bestScorer && bestScorer.id) || allInMatch[0].id;
            t.finalizeMatch(id);
            setMvpId('');
          }}>Salvar partida e atualizar estatísticas</button>
        </div>
      </div>
    );
  }

  function pickPlayer(playerId, playerTeam) {
    const evt = modal.evt;
    const result = t.registerEvent(evt, playerId, playerTeam);
    if (result && result.askReceiver) {
      setModal({ step: 'pickReceiver', opponentTeam: result.askReceiver });
    } else {
      setModal(null);
    }
  }

  return (
    <>
      <div className="scoreboard">
        <div className="sb-teams">
          <div className="sb-team"><div className="name">{m.teamA}</div><div className="sb-score">{m.currentSet.a}</div></div>
          <div className="sb-vs">SET {m.sets.length + 1}</div>
          <div className="sb-team"><div className="name">{m.teamB}</div><div className="sb-score">{m.currentSet.b}</div></div>
        </div>
        <div className="sb-setpills">
          {m.sets.length ? m.sets.map((s, i) => <div key={i} className="set-pill">Set {i + 1}: {s.a}–{s.b}</div>)
            : <div className="set-pill">Primeiro set em andamento</div>}
        </div>
        <div className="sb-sets">Sets: {m.teamA} {m.setsWonA} × {m.setsWonB} {m.teamB} · melhor de {m.bestOf} · até {m.target} pts</div>
      </div>

      <div className="card">
        <h3>Registrar ponto</h3>
        <div className="evt-grid">
          {Object.entries(EVENT_TYPES).map(([key, ev]) => (
            <button key={key} className={`evt-btn ${ev.good ? 'good' : 'bad'}`} onClick={() => setModal({ step: 'pickPlayer', evt: key })}>
              <span className="emoji">{ev.emoji}</span>{ev.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 12 }}
          disabled={!m.undoStack || m.undoStack.length === 0}
          onClick={t.undoLastPoint}
        >
          ↶ Voltar último ponto
        </button>
      </div>

      <div className="card">
        <h3>Últimos lances</h3>
        {m.log.length === 0 ? <div className="muted">Nenhum ponto registrado ainda neste set.</div> :
          m.log.slice(-6).reverse().map((l, i) => (
            <div key={i} className="log-item"><span>{l.text}</span><span className="lt">{l.score}</span></div>
          ))}
      </div>

      <button className="btn btn-danger btn-block" style={{ marginBottom: 20 }} onClick={() => {
        if (confirm('Cancelar este jogo? O progresso não será salvo.')) t.cancelMatch();
      }}>Cancelar jogo</button>

      {modal && modal.step === 'pickPlayer' && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            <h3>{EVENT_TYPES[modal.evt].emoji} {EVENT_TYPES[modal.evt].label}</h3>
            <div className="modal-sub">Quem {EVENT_TYPES[modal.evt].point === 'self' ? 'fez a jogada' : 'cometeu o erro'}?</div>
            <div className="pick-list">
              {[m.teamA, m.teamB].flatMap(team => t.playersOfTeam(team).map(p => (
                <div key={p.id} className="pick-row" onClick={() => pickPlayer(p.id, team)}>
                  <span>{p.name}</span><span className="team-tag">{team}</span>
                </div>
              )))}
            </div>
          </div>
        </div>
      )}

      {modal && modal.step === 'pickReceiver' && (
        <div className="overlay">
          <div className="modal">
            <h3>Quem recebeu mal?</h3>
            <div className="modal-sub">Opcional — credita 1 quinada para quem errou a recepção do ace</div>
            <div className="pick-list">
              {t.playersOfTeam(modal.opponentTeam).map(p => (
                <div key={p.id} className="pick-row" onClick={() => { t.chooseReceiver(p.id); setModal(null); }}>
                  <span>{p.name}</span><span className="team-tag">{modal.opponentTeam}</span>
                </div>
              ))}
              <div className="pick-row" style={{ justifyContent: 'center', color: 'rgba(15,42,61,.5)' }} onClick={() => { t.chooseReceiver(null); setModal(null); }}>Pular</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
