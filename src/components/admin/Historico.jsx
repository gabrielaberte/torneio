import React, { useEffect, useState } from 'react';
import { getRegistryId, getViewerUrl, setViewerUrl } from '../../lib/storage';
import { buildPublicSnapshot, checkAdminSession, loginAdmin, logoutAdmin } from '../../lib/cloud';
import { PublicAwardsView, PublicTeamsView, ScheduleView, ScoutingView, StandingsView } from '../public/PublicViewer';
import { useToast } from '../ui/Toast';

export default function Historico({ t, eventId }) {
  const toast = useToast();
  const [adminPassword, setAdminPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [viewerUrl, setViewerUrlState] = useState(getViewerUrl());
  const [previewTab, setPreviewTab] = useState(null);
  const registryId = getRegistryId();
  const fixedLink = viewerUrl && registryId ? viewerUrl.replace(/\/$/, '') + '/?registry=' + registryId : null;
  const publicSnapshot = buildPublicSnapshot(t.teams, t.state.standings, t.state.history, t.state.bracket, t.state.current, t.state.roster, t.state.playerStats, t.state.publicAwardsEnabled);
  const awardsPreviewSnapshot = buildPublicSnapshot(t.teams, t.state.standings, t.state.history, t.state.bracket, t.state.current, t.state.roster, t.state.playerStats, true);
  const publicSnapshotBytes = new TextEncoder().encode(JSON.stringify(publicSnapshot)).length;
  const publicBinLimit = 1024 * 1024;
  const publicSnapshotPercent = publicSnapshotBytes / publicBinLimit * 100;
  const remainingBytes = Math.max(0, publicBinLimit - publicSnapshotBytes);

  function formatBytes(bytes) {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  useEffect(() => { checkAdminSession().then(setAuthenticated); }, []);
  async function signIn() {
    try {
      await loginAdmin(adminPassword);
      setAuthenticated(true);
      setAdminPassword('');
      toast('Acesso administrativo liberado neste navegador.');
    } catch { toast('Não foi possível autenticar. Confira a senha administrativa.'); }
  }
  async function signOut() {
    try { await logoutAdmin(); setAuthenticated(false); toast('Sessão administrativa encerrada.'); }
    catch { toast('Não foi possível encerrar a sessão.'); }
  }
  function saveUrl() { setViewerUrl(viewerUrl.trim()); toast('Link salvo'); }
  function doExport() {
    const data = t.exportBackup();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data).then(() => toast('Backup copiado! Cole em uma nota segura.')).catch(() => window.prompt('Copie o texto abaixo:', data));
    } else window.prompt('Copie o texto abaixo:', data);
  }
  function doImportBackup() {
    const raw = prompt('Cole aqui o backup copiado anteriormente:');
    if (raw) t.importBackup(raw);
  }
  function doResetTournament() {
    if (!window.confirm('Apagar todos os registros deste torneio? Isso limpa elenco, times, estatísticas, partidas, placares e chaveamento. Esta ação não pode ser desfeita.')) return;
    t.resetTournament();
  }

  return (
    <>
      <div className="card">
        <h3>Acesso administrativo</h3>
        <div className="muted" style={{ marginBottom: 10 }}>A senha é configurada no servidor e não fica salva neste aparelho. A sessão expira após 8 horas.</div>
        {authenticated ? <button className="btn btn-ghost btn-block" onClick={signOut}>Encerrar sessão administrativa</button> : <>
          <label>Senha administrativa</label>
          <input type="password" autoComplete="current-password" placeholder="Senha configurada no servidor" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
          <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={signIn}>Entrar</button>
        </>}
      </div>
      <div className="card">
        <h3>Sincronizar entre aparelhos</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Grava este torneio inteiro (elenco, jogos, estatísticas) numa nuvem privada, para continuar de outro aparelho.</div>
        {t.state.sync.binId ? <>
          <div className="muted">Código de sincronização deste torneio:</div>
          <div style={{ fontWeight: 800, wordBreak: 'break-all', margin: '6px 0 12px', fontSize: 14 }}>{t.state.sync.binId}</div>
          <button className="btn btn-navy btn-block" onClick={t.pushNow}>Salvar na nuvem agora</button>
        </> : <button className="btn btn-navy btn-block" onClick={t.activateSync}>Ativar sincronização</button>}
      </div>
      <div className="card">
        <h3>Publicar placar (site próprio)</h3>
        <div className="storage-meter">
          <div className="muted">Próxima publicação: <b>{formatBytes(publicSnapshotBytes)}</b> de 1 MB ({publicSnapshotPercent.toFixed(1)}%)</div>
          <div className="storage-track"><div className={publicSnapshotPercent >= 100 ? 'storage-fill danger' : publicSnapshotPercent >= 85 ? 'storage-fill warning' : 'storage-fill'} style={{ width: `${Math.min(100, publicSnapshotPercent)}%` }} /></div>
          <div className="muted">{publicSnapshotBytes > publicBinLimit ? `Acima do limite padrão em ${formatBytes(publicSnapshotBytes - publicBinLimit)}.` : `Espaço estimado restante: ${formatBytes(remainingBytes)}.`} O cálculo inclui as fotos e representa os dados locais ainda não publicados.</div>
        </div>
        <div className="muted" style={{ marginBottom: 10 }}>Configure o link do site publicado uma única vez — ele vale para todos os torneios.</div>
        <label>Link do site publicado (Vercel)</label>
        <input type="text" placeholder="https://seu-projeto.vercel.app" value={viewerUrl} onChange={e => setViewerUrlState(e.target.value)} />
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={saveUrl}>Salvar link do site</button>
        {fixedLink ? <div className="muted" style={{ marginTop: 14 }}>Link fixo para compartilhar:<br /><b style={{ wordBreak: 'break-all' }}>{fixedLink}</b></div> : <div className="muted" style={{ marginTop: 10 }}>O link fixo aparece depois da primeira publicação.</div>}
        {t.publicationPending && <div className="muted" style={{ marginTop: 12 }}>Publicação pendente: será enviada quando a internet voltar.</div>}
        <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={() => setPreviewTab('scouting')}>Pré-visualizar Scouting neste aparelho</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setPreviewTab('teams')}>Pré-visualizar Times neste aparelho</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setPreviewTab('standings')}>Pré-visualizar Classificação do modo acompanhante</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setPreviewTab('schedule')}>Pré-visualizar chaveamento público</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setPreviewTab('awards')}>Pré-visualizar Premiações neste aparelho</button>
      </div>
      <div className="card">
        <h3>Backup manual</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Copie o backup de vez em quando durante o torneio.</div>
        <button className="btn btn-ghost btn-block" style={{ marginBottom: 8 }} onClick={doExport}>Copiar backup</button>
        <button className="btn btn-ghost btn-block" onClick={doImportBackup}>Restaurar backup</button>
      </div>
      <div className="card">
        <h3>Reiniciar torneio</h3>
        <div className="muted" style={{ marginBottom: 10 }}>Apaga o elenco, times, estatísticas, partidas, placares e chaveamento deste torneio. Os links de publicação e sincronização são mantidos para você continuar usando o torneio vazio.</div>
        <button className="btn btn-danger btn-block" onClick={doResetTournament}>Apagar dados e começar do zero</button>
      </div>
      {t.state.history.length === 0 ? <div className="empty"><div className="big">🗒️</div>Nenhuma partida finalizada ainda.</div> : [...t.state.history].reverse().map((m, i) => (
        <div key={i} className="card">
          <h3>{m.teamA} {m.setsWonA} × {m.setsWonB} {m.teamB}</h3>
          <div className="muted">Sets: {m.sets.map(s => `${s.a}-${s.b}`).join(' · ')}</div>
          <div className="muted" style={{ marginTop: 6 }}>Vencedor: <b>{m.winner}</b> · MVP: <b>{m.mvpName || '—'}</b></div>
        </div>
      ))}
      {previewTab && <div className="overlay" onClick={() => setPreviewTab(null)}>
        <div className="modal scouting-preview-modal" onClick={event => event.stopPropagation()}>
          <button className="modal-close" aria-label="Fechar pré-visualização" onClick={() => setPreviewTab(null)}>×</button>
          <h3>{previewTab === 'scouting' ? 'Pré-visualização do Scouting' : previewTab === 'teams' ? 'Pré-visualização de Times' : previewTab === 'standings' ? 'Pré-visualização da Classificação' : previewTab === 'awards' ? 'Pré-visualização das Premiações' : 'Pré-visualização do chaveamento público'}</h3>
          <div className="modal-sub">Dados locais deste aparelho. A prévia não publica alterações.</div>
          {previewTab === 'awards'
            ? <PublicAwardsView snapshot={awardsPreviewSnapshot} />
            : previewTab === 'scouting'
            ? <ScoutingView snapshot={publicSnapshot} tournamentId={`local-preview-${eventId}`} />
            : previewTab === 'teams'
              ? <PublicTeamsView snapshot={publicSnapshot} />
              : previewTab === 'standings'
                ? <StandingsView snapshot={publicSnapshot} />
                : <ScheduleView snapshot={publicSnapshot} />}
        </div>
      </div>}
    </>
  );
}
