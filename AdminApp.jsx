import { useState } from 'react';
import { getEvents } from '../../lib/storage';
import { useTournament } from '../../hooks/useTournament';
import Elenco from './Elenco';
import Jogo from './Jogo';
import Stats from './Stats';
import Times from './Times';
import Historico from './Historico';

const TABS = [
  ['elenco', 'Elenco'],
  ['jogo', 'Jogo'],
  ['stats', 'Estatísticas'],
  ['times', 'Times'],
  ['historico', 'Histórico']
];

export default function AdminApp({ eventId, onSwitchEvent, onSwitchRole }) {
  const [tab, setTab] = useState('elenco');
  const t = useTournament(eventId);
  const eventName = (getEvents().find(e => e.id === eventId) || {}).name || 'Torneio';

  return (
    <>
      <div className="topbar">
        <div className="brand"><div className="ball" /><h1>Placar Vôlei</h1></div>
        <div className="sub">
          <span onClick={onSwitchEvent}>{eventName} · trocar torneio ↺</span>
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
        {tab === 'elenco' && <Elenco t={t} />}
        {tab === 'jogo' && <Jogo t={t} />}
        {tab === 'stats' && <Stats t={t} />}
        {tab === 'times' && <Times t={t} />}
        {tab === 'historico' && <Historico t={t} eventName={eventName} />}
      </div>
    </>
  );
}
