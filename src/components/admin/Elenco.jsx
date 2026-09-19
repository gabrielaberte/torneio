import React from 'react';

import { useState } from 'react';
import { GENDERS } from '../../lib/constants';
import { useToast } from '../ui/Toast';

export default function Elenco({ t }) {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [gender, setGender] = useState('M');

  function save() {
    if (!name.trim() || !team.trim()) { toast('Preencha nome e time'); return; }
    t.addPlayer({ name: name.trim(), team: team.trim(), gender });
    setName(''); setTeam(''); setGender('M'); setModalOpen(false);
    toast('Participante adicionado');
  }

  return (
    <>
      <div className="card">
        <h3>Adicionar participante</h3>
        <button className="btn btn-primary btn-block" onClick={() => setModalOpen(true)}>+ Novo participante</button>
      </div>

      {t.teams.length === 0 ? (
        <div className="empty"><div className="big">🏐</div>Nenhum participante cadastrado ainda.<br />Adicione os jogadores e o time de cada um.</div>
      ) : t.teams.map(team => {
        const players = t.playersOfTeam(team);
        return (
          <div key={team} className="card team-group">
            <h4>{team} <span className="muted">({players.length})</span></h4>
            {players.map(p => (
              <div key={p.id} className="player-row">
                <div className="player-name"><span className={`gender-badge ${p.gender}`}>{p.gender}</span>{p.name}</div>
                <button className="icon-btn" onClick={() => t.deletePlayer(p.id)}>✕</button>
              </div>
            ))}
          </div>
        );
      })}

      {modalOpen && (
        <div className="overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            <h3>Novo participante</h3>
            <div className="modal-sub">Preencha os dados do jogador</div>
            <label>Nome</label>
            <input type="text" placeholder="Nome do jogador" value={name} onChange={e => setName(e.target.value)} />
            <label>Time</label>
            <input type="text" placeholder="Ex: Time 1" list="teamList" value={team} onChange={e => setTeam(e.target.value)} />
            <datalist id="teamList">{t.teams.map(tm => <option key={tm} value={tm} />)}</datalist>
            <label>Gênero</label>
            <div className="gender-row">
              <div className={`gender-opt ${gender === 'M' ? 'selected-M' : ''}`} onClick={() => setGender('M')}>{GENDERS.M}</div>
              <div className={`gender-opt ${gender === 'F' ? 'selected-F' : ''}`} onClick={() => setGender('F')}>{GENDERS.F}</div>
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={save}>Salvar</button>
          </div>
        </div>
      )}
    </>
  );
}
