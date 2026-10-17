import React, { useEffect, useState } from 'react';
import { getEvents, createEventEntry, deleteEventEntry, setCurrentEventId, normalizeEventState } from '../lib/storage';
import { checkAdminSession, importSyncedEvent, loginAdmin } from '../lib/cloud';
import { uid } from '../lib/constants';
import { useToast } from './ui/Toast';

export default function EventPicker({ onOpenEvent, onSwitchRole }) {
  const toast = useToast();
  const [events, setEvents] = useState(getEvents());
  const [name, setName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [impCode, setImpCode] = useState('');
  useEffect(() => { checkAdminSession().then(setAuthenticated); }, []);
  function refresh() { setEvents(getEvents()); }
  function create() {
    if (!name.trim()) { toast('Dê um nome para o torneio'); return; }
    const id = createEventEntry(name.trim());
    setCurrentEventId(id);
    onOpenEvent(id);
  }
  function open(id) { setCurrentEventId(id); onOpenEvent(id); }
  function remove(id) {
    if (confirm('Isso vai apagar todos os dados desse torneio. Tem certeza?')) {
      deleteEventEntry(id);
      refresh();
    }
  }
  async function doImport() {
    if (!impCode.trim() || (!authenticated && !adminPassword)) { toast('Informe o código e a senha administrativa.'); return; }
    try {
      if (!authenticated) {
        await loginAdmin(adminPassword);
        setAuthenticated(true);
        setAdminPassword('');
      }
      const record = await importSyncedEvent(impCode.trim());
      const id = uid();
      const events2 = getEvents();
      events2.push({ id, name: record.eventName || 'Torneio importado', createdAt: new Date().toISOString() });
      localStorage.setItem('volei_events', JSON.stringify(events2));
      const state = normalizeEventState(record.state);
      state.sync = { ...state.sync, binId: impCode.trim() };
      localStorage.setItem('volei_state_' + id, JSON.stringify(state));
      setCurrentEventId(id);
      toast('Torneio importado com sucesso!');
      onOpenEvent(id);
    } catch { toast('Não foi possível importar. Confira a senha e o código de sincronização.'); }
  }
  return <>
    <div className="topbar">
      <div className="brand"><div className="ball" /><h1>Torneio de Maluco</h1></div>
      <div className="sub" onClick={onSwitchRole}>Selecione um torneio · trocar modo</div>
    </div>
    <div className="content">
      {events.length === 0 ? <div className="empty"><div className="big">🏐</div>Nenhum torneio cadastrado ainda.</div> : events.map(ev => (
        <div key={ev.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontWeight: 800, fontSize: 15 }}>{ev.name}</div><div className="muted">Criado em {new Date(ev.createdAt).toLocaleDateString('pt-BR')}</div></div>
          <div style={{ display: 'flex', gap: 6 }}><button className="btn btn-sm btn-navy" onClick={() => open(ev.id)}>Abrir</button><button className="icon-btn" onClick={() => remove(ev.id)}>×</button></div>
        </div>
      ))}
      <div className="card">
        <h3>Novo torneio</h3>
        <label>Nome do torneio</label>
        <input type="text" placeholder="Ex: Torneio Verão 2026" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={create}>Criar torneio</button>
      </div>
      <div className="card">
        <h3>Importar torneio de outro aparelho</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Use o código gerado na aba Histórico. O acesso administrativo é configurado no servidor.</div>
        {!authenticated && <><label>Senha administrativa</label><input type="password" autoComplete="current-password" placeholder="Senha administrativa" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} /></>}
        <label>Código de sincronização</label>
        <input type="text" placeholder="Cole o código gerado no outro aparelho" value={impCode} onChange={e => setImpCode(e.target.value)} />
        <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={doImport}>Importar torneio</button>
      </div>
    </div>
  </>;
}
