import React, { useState } from 'react';
import { getPin, setPin, resetPin, setUnlocked } from '../lib/storage';
import { useToast } from './ui/Toast';

export default function Lock({ onUnlock, onSwitchRole }) {
  const toast = useToast();
  const [val, setVal] = useState('');
  const hasPin = !!getPin();

  function createPin() {
    if (val.trim().length < 3) { toast('Escolha um PIN com pelo menos 3 caracteres'); return; }
    setPin(val.trim());
    setUnlocked();
    onUnlock();
  }
  function submitPin() {
    if (val.trim() === getPin()) { setUnlocked(); onUnlock(); }
    else toast('PIN incorreto');
  }
  function forgotPin() {
    if (confirm('Isso vai apagar o PIN atual (os dados dos torneios continuam salvos). Deseja continuar?')) {
      resetPin();
      setVal('');
      // força re-render mostrando tela de criar PIN
      onUnlock('reset');
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="brand"><div className="ball" /><h1>Torneio de Maluco</h1></div>
        <div className="sub" onClick={onSwitchRole}>Acesso do administrador · trocar modo</div>
      </div>
      <div className="content" style={{ paddingTop: 30 }}>
        <div className="card">
          {hasPin ? (
            <>
              <h3>Digite o PIN</h3>
              <div className="modal-sub">Só quem organiza o torneio deve saber esse PIN.</div>
              <input type="password" inputMode="numeric" placeholder="PIN" style={{ textAlign: 'center', fontSize: 20, letterSpacing: '.2em' }}
                value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitPin()} />
              <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={submitPin}>Entrar</button>
              <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={forgotPin}>Esqueci o PIN</button>
            </>
          ) : (
            <>
              <h3>Crie um PIN de administrador</h3>
              <div className="modal-sub">Você vai usar esse PIN toda vez que abrir o app neste navegador. Guarde em um lugar seguro.</div>
              <input type="password" inputMode="numeric" placeholder="Crie um PIN (ex: 4 dígitos)" style={{ textAlign: 'center', fontSize: 20, letterSpacing: '.2em' }}
                value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && createPin()} />
              <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={createPin}>Criar PIN e entrar</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
