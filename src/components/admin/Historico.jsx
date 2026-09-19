import React from 'react';

import { useState } from 'react';
import { getJsonbinKey, setJsonbinKey, getRegistryId, getViewerUrl, setViewerUrl } from '../../lib/storage';
import { useToast } from '../ui/Toast';

export default function Historico({ t, eventName }) {
  const toast = useToast();
  const [jbKey, setJbKey] = useState(getJsonbinKey());
  const [viewerUrl, setViewerUrlState] = useState(getViewerUrl());
  const registryId = getRegistryId();
  const fixedLink = (viewerUrl && registryId) ? (viewerUrl.replace(/\/$/, '') + '/?registry=' + registryId) : null;

  function saveKey() { setJsonbinKey(jbKey.trim()); toast('Chave salva'); }
  function saveUrl() { setViewerUrl(viewerUrl.trim()); toast('Link salvo'); }

  function doExport() {
    const data = t.exportBackup();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data).then(() => toast('Backup copiado! Cole em uma nota segura.')).catch(() => window.prompt('Copie o texto abaixo:', data));
    } else {
      window.prompt('Copie o texto abaixo:', data);
    }
  }
  function doImportBackup() {
    const raw = prompt('Cole aqui o backup copiado anteriormente:');
    if (!raw) return;
    t.importBackup(raw);
  }

  return (
    <>
      <div className="card">
        <h3>Conta jsonbin.io</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Uma única chave gratuita usada pra sincronizar entre seus aparelhos e pra publicar os placares.</div>
        <label>Master Key</label>
        <input type="password" placeholder="Cole sua Master Key" value={jbKey} onChange={e => setJbKey(e.target.value)} />
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={saveKey}>Salvar chave</button>
      </div>

      <div className="card">
        <h3>Sincronizar entre aparelhos</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Grava este torneio inteiro (elenco, jogos, estatísticas) numa nuvem privada, pra você continuar de outro celular quando quiser.</div>
        {t.state.sync.binId ? (
          <>
            <div className="muted">Código de sincronização deste torneio:</div>
            <div style={{ fontWeight: 800, wordBreak: 'break-all', margin: '6px 0 12px', fontSize: 14 }}>{t.state.sync.binId}</div>
            <button className="btn btn-navy btn-block" onClick={t.pushNow}>Salvar na nuvem agora</button>
          </>
        ) : (
          <button className="btn btn-navy btn-block" onClick={t.activateSync}>Ativar sincronização</button>
        )}
      </div>

      <div className="card">
        <h3>Publicar placar (site próprio)</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Configure o link do site publicado uma única vez — ele vale pra todos os torneios que você criar daqui pra frente.</div>
        <label>Link do site publicado (Vercel)</label>
        <input type="text" placeholder="https://seu-projeto.vercel.app" value={viewerUrl} onChange={e => setViewerUrlState(e.target.value)} />
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={saveUrl}>Salvar link do site</button>
        {fixedLink ? (
          <div className="muted" style={{ marginTop: 14 }}>Link fixo pra compartilhar (nunca muda, mesmo em torneios futuros):<br /><b style={{ wordBreak: 'break-all' }}>{fixedLink}</b></div>
        ) : <div className="muted" style={{ marginTop: 10 }}>O link fixo aparece aqui depois da primeira publicação.</div>}
        <button className="btn btn-navy btn-block" style={{ marginTop: 14 }} onClick={t.publish}>Publicar placar deste torneio</button>
      </div>

      <div className="card">
        <h3>Backup manual</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Use isso como reforço caso o salvamento automático falhe. Copie o backup de vez em quando durante o torneio.</div>
        <button className="btn btn-ghost btn-block" style={{ marginBottom: 8 }} onClick={doExport}>Copiar backup</button>
        <button className="btn btn-ghost btn-block" onClick={doImportBackup}>Restaurar backup</button>
      </div>

      {t.state.history.length === 0 ? (
        <div className="empty"><div className="big">🗒️</div>Nenhuma partida finalizada ainda.</div>
      ) : [...t.state.history].reverse().map((m, i) => (
        <div key={i} className="card">
          <h3>{m.teamA} {m.setsWonA} × {m.setsWonB} {m.teamB}</h3>
          <div className="muted">Sets: {m.sets.map(s => `${s.a}-${s.b}`).join(' · ')}</div>
          <div className="muted" style={{ marginTop: 6 }}>Vencedor: <b>{m.winner}</b> · MVP: <b>{m.mvpName || '—'}</b></div>
        </div>
      ))}
    </>
  );
}
