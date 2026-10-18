import React, { useState } from 'react';
import { getEvents, renameEventEntry } from '../../lib/storage';
import { useTournament } from '../../hooks/useTournament';
import { useToast } from '../ui/Toast';
import Cadastro from './Cadastro';
import Jogo from './Jogo';
import Stats from './Stats';
import Times from './Times';
import Historico from './Historico';
import Formato2Fases from './Formato2FasesEditavel';

const TABS = [
  ['elenco', 'Elenco'],
  ['jogo', 'Jogo'],
  ['stats', 'Estatísticas'],
  ['times', 'Times'],
  ['chaveamento', 'Chaveamento'],
  ['historico', 'Histórico']
];

export default function AdminApp({ eventId, onSwitchEvent, onSwitchRole }) {
  const [tab, setTab] = useState('elenco');
  const [eventName, setEventName] = useState(() => (getEvents().find(e => e.id === eventId) || {}).name || 'Torneio');
  const toast = useToast();
  const t = useTournament(eventId);

  function renameTournament() {
    const name = window.prompt('Novo nome do torneio:', eventName);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) { toast('Dê um nome para o torneio'); return; }
    renameEventEntry(eventId, trimmed);
    setEventName(trimmed);
    toast('Nome do torneio atualizado.');
  }

  return (
    <>
      <div className="topbar">
        <div className="brand"><div className="ball" /><h1>Torneio de Maluco</h1></div>
        <div className="sub">
          <span>{eventName}</span>{' '}<button className="btn btn-sm btn-ghost" onClick={renameTournament}>Mudar nome</button>{' '}<span onClick={onSwitchEvent}>· trocar torneio ↺</span>
          {' '}|{' '}
          <span onClick={onSwitchRole}>trocar modo</span>
        </div>
      </div>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <div key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>
      <div className="content">
        {tab === 'elenco' && <Cadastro t={t} />}
        {tab === 'jogo' && <Jogo t={t} />}
        {tab === 'stats' && <Stats t={t} />}
        {tab === 'times' && <Times t={t} />}
        {tab === 'chaveamento' && <Formato2Fases t={t} />}
        {tab === 'historico' && <Historico t={t} eventId={eventId} eventName={eventName} />}
      </div>
    </>
  );
}
