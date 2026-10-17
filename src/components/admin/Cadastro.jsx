import React, { useRef, useState } from 'react';
import { GENDERS } from '../../lib/constants';
import { parsePlayerWorkbook } from '../../lib/playerImport';
import { useToast } from '../ui/Toast';

export default function Cadastro({ t }) {
  const toast = useToast();
  const [view, setView] = useState('players');
  const [player, setPlayer] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [showImport, setShowImport] = useState(false);
  function save(data) { if (!data.name.trim()) return toast('Informe o nome.'); if (player.id) t.updatePlayer(player.id, data); else t.addPlayer(data); setPlayer(null); }
  function addTeam() { const name = teamName.trim(); if (!name) return toast('Informe o nome do time.'); if (t.teams.includes(name)) return toast('Este time já existe.'); t.addTeam(name); setTeamName(''); }
  return <>
    <div className="tabs"><div className={`tab ${view === 'players' ? 'active' : ''}`} onClick={() => setView('players')}>Jogadores</div><div className={`tab ${view === 'teams' ? 'active' : ''}`} onClick={() => setView('teams')}>Times</div></div>
    {view === 'players' ? <Players t={t} onNew={() => setPlayer({ id: null, name: '', gender: 'M', registrationValid: false })} onEdit={setPlayer} onImport={() => setShowImport(true)} /> : <Teams t={t} name={teamName} setName={setTeamName} onAdd={addTeam} onSelect={setSelectedTeam} />}
    {showImport && <PlayerImportPreview roster={t.state.roster} onClose={() => setShowImport(false)} />}
    {player && <PlayerForm player={player} onClose={() => setPlayer(null)} onSave={save} />}
    {selectedTeam && <TeamForm team={selectedTeam} t={t} onClose={() => setSelectedTeam(null)} />}
  </>;
}

function Players({ t, onNew, onEdit, onImport }) {
  return <>
    <div className="card">
      <h3>Cadastro de jogadores</h3>
      <div className="muted" style={{ marginBottom: 12 }}>Cadastre nome, sexo e a validação da inscrição. Somente inscritos válidos podem entrar em um time.</div>
      <button className="btn btn-primary btn-block" onClick={onNew}>+ Cadastrar jogador</button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onImport}>Importar planilha Excel · prévia</button>
    </div>
    {t.state.roster.length === 0 ? <div className="empty">Nenhum jogador cadastrado.</div> : t.state.roster.map(p => <div className="card" key={p.id}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><div><b>{p.name}</b> <span className={`gender-badge ${p.gender}`}>{p.gender}</span><div className="muted" style={{ marginTop: 4 }}>{p.registrationValid === false ? 'Inscrição pendente' : 'Inscrição válida'} · {p.team || 'Sem time'}</div></div><button className="btn btn-ghost" onClick={() => onEdit(p)}>Editar</button></div></div>)}
  </>;
}

function PlayerImportPreview({ roster, onClose }) {
  const inputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  async function readFile(file) {
    if (!file) return;
    setResult(null);
    setError('');
    setFileName(file.name);
    try {
      const parsed = await parsePlayerWorkbook(await file.arrayBuffer(), roster);
      setResult(parsed);
    } catch (e) {
      setError(e.message || 'Não foi possível ler esta planilha.');
    }
  }
  return <div className="overlay" onClick={onClose}>
    <div className="modal" style={{ maxWidth: 760, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose}>×</button>
      <h3>Importar planilha · prévia</h3>
      <div className="modal-sub">A leitura e a prévia não alteram o cadastro. Formatos .xlsx e .xls.</div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={e => readFile(e.target.files && e.target.files[0])} />
      {fileName && <div className="muted" style={{ marginTop: 8 }}>{fileName}</div>}
      {error && <div className="card" role="alert" style={{ color: '#a12622', marginTop: 12 }}>{error}</div>}
      {result && <>
        <div className="card" style={{ marginTop: 12 }}>
          <b>Resumo:</b> {result.records.length} linhas · {result.validCount} válidas · {result.errorCount} com erros · {result.duplicateCount} possíveis duplicatas · {result.skippedEmptyRows} linhas vazias ignoradas
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th>Linha</th><th>Nome</th><th>Gênero</th><th>Inscrição</th><th>Pot</th><th>Histórico</th><th>Resultado</th></tr></thead>
            <tbody>{result.records.map(record => {
              const data = record.data;
              const history = data.scoutingHistory;
              const historyValues = history ? Object.values(history.awards).concat(Object.values(history.podiums)).filter(value => value !== undefined).length : 0;
              const issues = [];
              if (record.errors.length) issues.push(record.errors.join(' '));
              if (record.duplicate) issues.push(record.duplicateNames.length ? 'Possível duplicata existente: ' + record.duplicateNames.join(', ') : 'Nome repetido na planilha.');
              return <tr key={record.sourceRow}>
                <td>{record.sourceRow}</td><td>{data.name || '—'}</td><td>{data.gender || '—'}</td><td>{data.registrationValid === null ? '—' : data.registrationValid ? 'Sim' : 'Não'}</td><td>{data.pot === undefined ? '—' : data.pot}</td><td>{history ? Object.entries(history.awards).concat(Object.entries(history.podiums)).filter(function (entry) { return entry[1] !== undefined; }).map(function (entry) { return entry[0] + ': ' + entry[1]; }).join(' · ') : '—'}</td>
                <td style={{ color: record.errors.length ? '#a12622' : record.duplicate ? '#9a6700' : 'inherit' }}>{issues.length ? issues.join(' ') : 'Válida'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </>}
      <div className="muted" style={{ marginTop: 12 }}>Esta etapa não confirma nem salva a importação. Fechar ou cancelar mantém o cadastro inalterado.</div>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={onClose}>Cancelar / fechar</button>
    </div>
  </div>;
}

function Teams({ t, name, setName, onAdd, onSelect }) { return <><div className="card"><h3>Cadastrar time</h3><input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do time" /><button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={onAdd}>+ Criar time</button></div>{t.teams.length === 0 ? <div className="empty">Cadastre um time para montar sua equipe.</div> : t.teams.map(team => { const count = t.playersOfTeam(team).filter(p => p.registrationValid !== false).length; return <div className="card" key={team}><h3>{team}</h3><div className="muted" style={{ marginBottom: 10 }}>{count}/6 jogadores com inscrição válida {count === 6 ? '· apto para jogar' : '· não apto para jogar'}</div><button className="btn btn-ghost btn-block" onClick={() => onSelect(team)}>Escolher jogadores</button></div>; })}</>; }

function PlayerForm({ player, onClose, onSave }) { const [name, setName] = useState(player.name); const [gender, setGender] = useState(player.gender); const [valid, setValid] = useState(player.registrationValid !== false); return <div className="overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h3>{player.id ? 'Editar jogador' : 'Novo jogador'}</h3><label>Nome</label><input value={name} onChange={e => setName(e.target.value)} /><label>Sexo</label><div className="gender-row"><div className={`gender-opt ${gender === 'M' ? 'selected-M' : ''}`} onClick={() => setGender('M')}>{GENDERS.M}</div><div className={`gender-opt ${gender === 'F' ? 'selected-F' : ''}`} onClick={() => setGender('F')}>{GENDERS.F}</div></div><label>Inscrição</label><select value={valid ? 'yes' : 'no'} onChange={e => setValid(e.target.value === 'yes')}><option value="no">Não validada / pendente</option><option value="yes">Válida (pagamento confirmado)</option></select><button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => onSave({ name: name.trim(), gender, registrationValid: valid })}>Salvar</button></div></div>; }

function TeamForm({ team, t, onClose }) { const toast = useToast(); const members = t.playersOfTeam(team).filter(p => p.registrationValid !== false); function change(p) { if (p.team === team) return t.assignPlayerToTeam(p.id, ''); if (members.length >= 6) return toast('O time já possui 6 jogadores válidos.'); t.assignPlayerToTeam(p.id, team); } return <div className="overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h3>{team}</h3><div className="modal-sub">Escolha até 6 jogadores com inscrição válida. Ao selecionar alguém de outro time, ele será transferido.</div><div className="pick-list">{t.state.roster.filter(p => p.registrationValid !== false).map(p => <label className="pick-row" key={p.id}><span><input type="checkbox" checked={p.team === team} onChange={() => change(p)} style={{ width: 'auto', marginRight: 8 }} />{p.name}</span><span className="team-tag">{p.team !== team ? p.team : ''}</span></label>)}</div><button className="btn btn-danger btn-block" style={{ marginTop: 14 }} onClick={() => { if (confirm('Excluir ' + team + '? Os jogadores ficarão sem time.')) { t.deleteTeam(team); onClose(); } }}>Excluir time</button></div></div>; }


