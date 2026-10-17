import React, { useRef, useState } from 'react';
import { GENDERS } from '../../lib/constants';
import { normalizePlayerName, parsePlayerWorkbook } from '../../lib/playerImport';
import { useToast } from '../ui/Toast';

const AWARD_FIELDS = [
  ['mvp', 'MVP'], ['bestServer', 'Melhor sacador'], ['bestDefense', 'Melhor defesa'],
  ['bestAttack', 'Melhor ataque'], ['topScorer', 'Maior pontuador'], ['bestBlocker', 'Melhor bloqueio']
];
const PODIUM_FIELDS = [['first', '1º lugar'], ['second', '2º lugar'], ['third', '3º lugar']];
const POT_COLORS = ['#d9e6f2', '#b9d9c8', '#f5dfa2', '#efc1a6', '#d8c1e8'];
function comparePlayersByPot(a, b) {
  return (Number.isInteger(a.pot) ? a.pot : 5) - (Number.isInteger(b.pot) ? b.pot : 5);
}

function compressPlayerPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Selecione um arquivo de imagem.'));
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const maxSize = 160;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) { URL.revokeObjectURL(objectUrl); reject(new Error('Não foi possível processar a imagem.')); return; }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.68));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Não foi possível abrir essa imagem.')); };
    image.src = objectUrl;
  });
}

export default function Cadastro({ t }) {
  const toast = useToast();
  const [view, setView] = useState('players');
  const [player, setPlayer] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [playerQuery, setPlayerQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  function save(data) {
    if (!data.name.trim()) { toast('Informe o nome.'); return; }
    if ((data.gender !== undefined && !['M', 'F'].includes(data.gender)) || (!player.id && !data.gender) || typeof data.registrationValid !== 'boolean') { toast('Confira gênero e situação da inscrição.'); return; }
    if (Object.prototype.hasOwnProperty.call(data, 'pot') && data.pot !== null && (!Number.isInteger(data.pot) || data.pot < 0 || data.pot > 4)) { toast('Pote: informe um inteiro de 0 a 4.'); return; }
    const history = data.scoutingHistory || {};
    for (const value of [...Object.values(history.awards || {}), ...Object.values(history.podiums || {})]) {
      if (value !== null && (!Number.isInteger(value) || value < 0)) { toast('Premiações e pódios devem ser inteiros não negativos.'); return; }
    }
    if (player.id) t.updatePlayer(player.id, data); else t.addPlayer(data);
    setPlayer(null);
  }
  function addTeam() { const name = teamName.trim(); if (!name) return toast('Informe o nome do time.'); if (t.teams.includes(name)) return toast('Este time já existe.'); t.addTeam(name); setTeamName(''); }
  function renameTeam(currentName) {
    const nextName = window.prompt('Novo nome do time:', currentName);
    if (nextName === null) return;
    t.renameTeam(currentName, nextName);
  }
  return <>
    <div className="tabs"><div className={`tab ${view === 'players' ? 'active' : ''}`} onClick={() => setView('players')}>Jogadores</div><div className={`tab ${view === 'teams' ? 'active' : ''}`} onClick={() => setView('teams')}>Times</div></div>
    {view === 'players' ? <Players t={t} query={playerQuery} onQueryChange={setPlayerQuery} onNew={() => setPlayer({ id: null, name: '', gender: 'M', registrationValid: false, isCaptain: false })} onEdit={setPlayer} onImport={() => setShowImport(true)} /> : <Teams t={t} name={teamName} setName={setTeamName} onAdd={addTeam} onSelect={setSelectedTeam} onRename={renameTeam} />}
    {showImport && <PlayerImportPreview t={t} roster={t.state.roster} onClose={() => setShowImport(false)} />}
    {player && <PlayerForm player={player} onClose={() => setPlayer(null)} onSave={save} />}
    {selectedTeam && <TeamForm team={selectedTeam} t={t} onClose={() => setSelectedTeam(null)} />}
  </>;
}

function Players({ t, query, onQueryChange, onNew, onEdit, onImport }) {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPot, setBulkPot] = useState('');
  const normalizedQuery = normalizePlayerName(query);
  const filteredPlayers = t.state.roster.filter(player => normalizePlayerName(player.name).includes(normalizedQuery)).sort(comparePlayersByPot);
  const allVisibleSelected = filteredPlayers.length > 0 && filteredPlayers.every(player => selectedIds.includes(player.id));
  function togglePlayer(id) {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  function toggleVisible() {
    setSelectedIds(current => allVisibleSelected
      ? current.filter(id => !filteredPlayers.some(player => player.id === id))
      : [...new Set([...current, ...filteredPlayers.map(player => player.id)])]);
  }
  function applyBulkPot() {
    if (!selectedIds.length) return toast('Selecione pelo menos um jogador.');
    if (bulkPot === '') return toast('Escolha o pote a aplicar.');
    const pot = bulkPot === '__none__' ? null : Number(bulkPot);
    selectedIds.forEach(id => t.updatePlayer(id, { pot }));
    toast(`Pote atualizado para ${selectedIds.length} jogador(es).`);
    setSelectedIds([]);
    setBulkPot('');
  }
  return <>
    <div className="card">
      <h3>Cadastro de jogadores</h3>
      <div className="muted" style={{ marginBottom: 12 }}>Cadastre nome, sexo e a validação da inscrição. Somente inscritos válidos podem entrar em um time.</div>
      <button className="btn btn-primary btn-block" onClick={onNew}>+ Cadastrar jogador</button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onImport}>Importar planilha Excel · prévia</button>
      <label htmlFor="roster-name-filter">Buscar jogador por nome</label>
      <input id="roster-name-filter" type="text" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Digite o nome do jogador" />
      {query && <div className="muted" style={{ marginTop: 7 }}>{filteredPlayers.length} de {t.state.roster.length} jogadores encontrados</div>}
      {t.state.roster.length > 0 && <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 9 }} onClick={toggleVisible}>{allVisibleSelected ? 'Desmarcar jogadores visíveis' : 'Selecionar jogadores visíveis'}</button>}
      {selectedIds.length > 0 && <div className="bulk-pot-controls">
        <div className="muted">{selectedIds.length} selecionado(s)</div>
        <select aria-label="Pote para aplicar aos jogadores selecionados" value={bulkPot} onChange={event => setBulkPot(event.target.value)}>
          <option value="">Escolha o pote</option>
          {[0, 1, 2, 3, 4].map(pot => <option value={String(pot)} key={pot}>Pote {pot}</option>)}
          <option value="__none__">Remover pote</option>
        </select>
        <button type="button" className="btn btn-navy btn-block" onClick={applyBulkPot}>Aplicar aos selecionados</button>
      </div>}
    </div>
    {t.state.roster.length === 0 ? <div className="empty">Nenhum jogador cadastrado.</div> : filteredPlayers.length === 0 ? <div className="empty">Nenhum jogador encontrado com esse nome.</div> : <div className="player-list">{filteredPlayers.map(p => <div className="card player-card" key={p.id} style={{ backgroundColor: Number.isInteger(p.pot) && POT_COLORS[p.pot] ? POT_COLORS[p.pot] : '#fff' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 0 }}><input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={selectedIds.includes(p.id)} onChange={() => togglePlayer(p.id)} style={{ width: 'auto', marginTop: 4 }} /><div style={{ minWidth: 0 }}><b>{p.name}</b> <span className={`gender-badge ${p.gender}`}>{p.gender}</span><div className="muted" style={{ marginTop: 4 }}>{p.registrationValid === false ? 'Inscrição pendente' : 'Inscrição válida'} · {p.team || 'Sem time'}</div><div className="muted" style={{ marginTop: 4 }}>{p.pot === undefined || p.pot === null ? 'Pote não informado' : `Pote ${p.pot}`}{p.isCaptain ? ' · Capitã' : ''}</div></div></div><button className="btn btn-ghost" onClick={() => onEdit(p)}>Editar</button></div></div>)}</div>}
  </>;
}

function PlayerImportPreview({ t, roster, onClose }) {
  const [result, setResult] = useState(null);
  const [choices, setChoices] = useState({});
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  async function readFile(file) {
    if (!file) return;
    setResult(null);
    setSummary(null);
    setError('');
    setFileName(file.name);
    try {
      const parsed = await parsePlayerWorkbook(await file.arrayBuffer(), roster);
      setResult(parsed);
      setChoices(Object.fromEntries(parsed.records.map(record => [record.sourceRow, { action: record.duplicate ? '' : 'add' }])));
    } catch (e) {
      setError(e.message || 'Não foi possível ler esta planilha.');
    }
  }
  function choose(sourceRow, action, playerId) {
    const choice = action.indexOf('merge:') === 0 ? { action: 'merge', playerId: action.slice(6) } : { action };
    setChoices(current => ({ ...current, [sourceRow]: choice }));
    setError('');
  }
  function confirmImport() {
    const selections = result.records.map(record => ({ record, choice: choices[record.sourceRow] || {} }));
    const outcome = t.applyPlayerImport(selections);
    if (outcome.conflicts) {
      setError('Há conflitos sem resolução ou mais de uma linha selecionada para o mesmo nome. Escolha uma ação para cada duplicata e importe no máximo uma linha por nome.');
      return;
    }
    setSummary(outcome);
  }
  return <div className="overlay" onClick={onClose}>
    <div className="modal" style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose}>×</button>
      <h3>Importar planilha · prévia</h3>
      <div className="modal-sub">Selecione uma planilha .xlsx ou .xls. Nenhuma alteração ocorre até confirmar abaixo.</div>
      {!summary && <input type="file" accept=".xlsx,.xls" onChange={e => readFile(e.target.files && e.target.files[0])} />}
      {fileName && <div className="muted" style={{ marginTop: 8 }}>{fileName}</div>}
      {error && <div className="card" role="alert" style={{ color: '#a12622', marginTop: 12 }}>{error}</div>}
      {summary && <div className="card" role="status" style={{ marginTop: 12 }}>
        <b>Importação concluída:</b> {summary.inserted} inseridos · {summary.updated} atualizados · {summary.ignored} ignorados · {summary.conflicts} conflitos
      </div>}
      {result && !summary && <>
        <div className="card" style={{ marginTop: 12 }}>
          <b>Resumo:</b> {result.records.length} linhas · {result.validCount} válidas · {result.errorCount} com erros · {result.duplicateCount} possíveis duplicatas · {result.skippedEmptyRows} linhas vazias ignoradas
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th>Linha</th><th>Nome</th><th>Gênero</th><th>Inscrição</th><th>Pot</th><th>Histórico</th><th>Validação / conflito</th><th>Ação</th></tr></thead>
            <tbody>{result.records.map(record => {
              const data = record.data;
              const history = data.scoutingHistory;
              const issues = [];
              if (record.errors.length) issues.push(record.errors.join(' '));
              if (record.duplicate) issues.push(record.duplicateNames.length ? 'Possível duplicata existente: ' + record.duplicateNames.join(', ') : 'Nome repetido na planilha.');
              const choice = choices[record.sourceRow] || {};
              const choiceValue = choice.action === 'merge' ? 'merge:' + choice.playerId : choice.action || '';
              return <tr key={record.sourceRow}>
                <td>{record.sourceRow}</td><td>{data.name || '—'}</td><td>{data.gender || '—'}</td><td>{data.registrationValid === null ? '—' : data.registrationValid ? 'Sim' : 'Não'}</td><td>{data.pot === undefined ? '—' : data.pot}</td>
                <td>{history ? Object.entries(history.awards).concat(Object.entries(history.podiums)).filter(entry => entry[1] !== undefined).map(entry => entry[0] + ': ' + entry[1]).join(' · ') : '—'}</td>
                <td style={{ color: record.errors.length ? '#a12622' : record.duplicate ? '#9a6700' : 'inherit' }}>{issues.length ? issues.join(' ') : 'Válida'}</td>
                <td><select aria-label={'Ação para linha ' + record.sourceRow} disabled={Boolean(summary) || !record.valid} value={!record.valid ? 'skip' : choiceValue} onChange={e => choose(record.sourceRow, e.target.value)}>
                  {!record.valid ? <option value="skip">Ignorar · inválida</option> : <>
                    {record.duplicate && <option value="">Selecione ação</option>}
                    <option value="add">{record.duplicate ? 'Adicionar como atleta distinto' : 'Adicionar atleta'}</option>
                    {record.duplicateMatches && record.duplicateMatches.map(match => <option key={match.id} value={'merge:' + match.id}>Atualizar cadastro: {match.name}</option>)}
                    <option value="skip">Ignorar linha</option>
                  </>}
                </select>
                {record.duplicate && <div className="muted">Duplicatas da planilha devem ser resolvidas importando só uma linha com este nome.</div>}
              </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: 12 }}>Valores vazios preservam pote e histórico existentes. Uma linha marcada como inválida será ignorada. Atualizações preservam ID, time e estatísticas atuais, salvo inscrição inválida, que segue a regra existente de retirar do time.</div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={confirmImport}>Confirmar importação selecionada</button>
      </>}
      <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={onClose}>{summary ? 'Fechar' : 'Cancelar / fechar'}</button>
    </div>
  </div>;
}

function Teams({ t, name, setName, onAdd, onSelect, onRename }) {
  return <>
    <div className="card team-create-card">
      <h3>Cadastrar time</h3>
      <div className="team-create-controls"><input value={name} onChange={event => setName(event.target.value)} placeholder="Nome do time" /><button className="btn btn-primary" onClick={onAdd}>+ Criar time</button></div>
    </div>
    {t.teams.length === 0 ? <div className="empty">Cadastre um time para montar sua equipe.</div> : <div className="teams-grid">
      {t.teams.map(team => {
        const members = t.playersOfTeam(team).filter(player => player.registrationValid !== false);
        const count = members.length;
        return <div className="card team-summary-card" key={team}>
          <div className="team-summary-heading"><h3>{team}</h3><button className="btn btn-ghost btn-sm" onClick={() => onRename(team)}>Renomear</button></div>
          <div className="team-member-chips">
            {members.map(player => <span key={player.id} style={{ backgroundColor: Number.isInteger(player.pot) && POT_COLORS[player.pot] ? POT_COLORS[player.pot] : '#f1f3f4' }}>{player.name}{Number.isInteger(player.pot) ? ` · P${player.pot}` : ''}</span>)}
            {count === 0 && <span className="muted">Nenhum jogador válido</span>}
          </div>
          <div className="team-summary-footer"><span className={count === 6 ? 'team-ready' : 'team-not-ready'}>{count}/6 · {count === 6 ? 'Apto para jogar' : 'Não apto'}</span><button className="btn btn-navy btn-sm" onClick={() => onSelect(team)}>Editar seleção</button></div>
        </div>;
      })}
    </div>}
  </>;
}

function PlayerForm({ player, onClose, onSave }) {
  const [name, setName] = useState(player.name || '');
  const [photo, setPhoto] = useState(player.photo || '');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [gender, setGender] = useState(player.gender || (player.id ? '' : 'M'));
  const [valid, setValid] = useState(player.registrationValid !== false);
  const [pot, setPot] = useState(player.pot == null ? '' : String(player.pot));
  const [isCaptain, setIsCaptain] = useState(player.isCaptain === true);
  const [error, setError] = useState('');
  const [awards, setAwards] = useState(() => Object.fromEntries(AWARD_FIELDS.map(([key]) => {
    const value = player.scoutingHistory && player.scoutingHistory.awards && player.scoutingHistory.awards[key];
    return [key, value == null ? '' : String(value)];
  })));
  const [podiums, setPodiums] = useState(() => Object.fromEntries(PODIUM_FIELDS.map(([key]) => {
    const value = player.scoutingHistory && player.scoutingHistory.podiums && player.scoutingHistory.podiums[key];
    return [key, value == null ? '' : String(value)];
  })));

  async function handlePhotoChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setPhotoLoading(true);
    try { setPhoto(await compressPlayerPhoto(file)); setError(''); }
    catch (error) { setError(error.message || 'Não foi possível processar a imagem.'); }
    finally { setPhotoLoading(false); event.target.value = ''; }
  }

  function submit() {
    if (!name.trim()) { setError('Informe o nome do atleta.'); return; }
    if ((gender && !['M', 'F'].includes(gender)) || (!player.id && !gender)) { setError('Selecione um gênero válido.'); return; }
    if (pot !== '' && (!/^\d+$/.test(pot) || Number(pot) < 0 || Number(pot) > 4)) {
      setError('Pote: informe um inteiro de 0 a 4 ou deixe em branco.');
      return;
    }
    const allCounts = [...Object.entries(awards), ...Object.entries(podiums)];
    const invalidCount = allCounts.find(([, value]) => value !== '' && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))));
    if (invalidCount) { setError('Premiações e pódios devem ser inteiros não negativos ou ficar em branco.'); return; }

    const data = { name: name.trim(), photo, registrationValid: valid, isCaptain };
    if (['M', 'F'].includes(gender)) data.gender = gender;
    if (pot !== '') data.pot = Number(pot);
    else if (player.pot != null) data.pot = null;
    const history = { awards: {}, podiums: {} };
    Object.entries(awards).forEach(([key, value]) => {
      const previous = player.scoutingHistory && player.scoutingHistory.awards && player.scoutingHistory.awards[key];
      if (value !== '') history.awards[key] = Number(value);
      else if (previous != null) history.awards[key] = null;
    });
    Object.entries(podiums).forEach(([key, value]) => {
      const previous = player.scoutingHistory && player.scoutingHistory.podiums && player.scoutingHistory.podiums[key];
      if (value !== '') history.podiums[key] = Number(value);
      else if (previous != null) history.podiums[key] = null;
    });
    if (Object.keys(history.awards).length || Object.keys(history.podiums).length) data.scoutingHistory = history;
    setError('');
    onSave(data);
  }

  return <div className="overlay" onClick={onClose}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" aria-label="Fechar cadastro" onClick={onClose}>×</button>
      <h3>{player.id ? 'Editar jogador' : 'Novo jogador'}</h3>
      <label htmlFor="player-name">Nome</label>
      <input id="player-name" value={name} onChange={e => setName(e.target.value)} required />
      <label>Gênero</label>
      <div className="gender-row" role="group" aria-label="Gênero">
        <button type="button" className={`gender-opt ${gender === 'M' ? 'selected-M' : ''}`} aria-pressed={gender === 'M'} onClick={() => setGender('M')}>{GENDERS.M}</button>
        <button type="button" className={`gender-opt ${gender === 'F' ? 'selected-F' : ''}`} aria-pressed={gender === 'F'} onClick={() => setGender('F')}>{GENDERS.F}</button>
      </div>
      <label htmlFor="player-registration">Inscrição</label>
      <select id="player-registration" value={valid ? 'yes' : 'no'} onChange={e => setValid(e.target.value === 'yes')}>
        <option value="no">Não validada / pendente</option>
        <option value="yes">Válida (pagamento confirmado)</option>
      </select>
      <label htmlFor="player-pot">Pote (opcional, 0 a 4)</label>
      <input id="player-pot" type="number" inputMode="numeric" min="0" max="4" step="1" value={pot} aria-invalid={pot !== '' && (!/^\d+$/.test(pot) || Number(pot) > 4)} onChange={e => setPot(e.target.value)} />
      <label htmlFor="player-photo">Foto do participante (opcional)</label>
      <input id="player-photo" type="file" accept="image/*" onChange={handlePhotoChange} disabled={photoLoading} />
      <div className="player-photo-controls">
        {photo ? <img className="player-photo-preview" src={photo} alt={`Foto de ${name || 'participante'}`} /> : <span className="muted">Sem foto cadastrada</span>}
        {photo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto('')}>Remover foto</button>}
        {photoLoading && <span className="muted">Processando foto…</span>}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <input type="checkbox" checked={isCaptain} onChange={e => setIsCaptain(e.target.checked)} style={{ width: 'auto' }} />
        Capitã nesta edição
      </label>
      <fieldset style={{ marginTop: 14 }}>
        <legend>Premiações históricas (opcionais)</legend>
        {AWARD_FIELDS.map(([key, label]) => <div key={key}>
          <label htmlFor={`award-${key}`}>{label}</label>
          <input id={`award-${key}`} type="number" inputMode="numeric" min="0" step="1" placeholder="Não informado" value={awards[key]} aria-invalid={awards[key] !== '' && (!/^\d+$/.test(awards[key]) || !Number.isSafeInteger(Number(awards[key])))} onChange={e => setAwards(current => ({ ...current, [key]: e.target.value }))} />
        </div>)}
      </fieldset>
      <fieldset style={{ marginTop: 14 }}>
        <legend>Pódios históricos (opcionais)</legend>
        {PODIUM_FIELDS.map(([key, label]) => <div key={key}>
          <label htmlFor={`podium-${key}`}>{label}</label>
          <input id={`podium-${key}`} type="number" inputMode="numeric" min="0" step="1" placeholder="Não informado" value={podiums[key]} aria-invalid={podiums[key] !== '' && (!/^\d+$/.test(podiums[key]) || !Number.isSafeInteger(Number(podiums[key])))} onChange={e => setPodiums(current => ({ ...current, [key]: e.target.value }))} />
        </div>)}
      </fieldset>
      {error && <div role="alert" className="muted" style={{ color: '#a21b1b', marginTop: 10 }}>{error}</div>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={submit} disabled={photoLoading}>{photoLoading ? 'Processando foto…' : 'Salvar'}</button>
    </div>
  </div>;
}

function TeamForm({ team, t, onClose }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [potFilter, setPotFilter] = useState('all');
  const members = t.playersOfTeam(team).filter(player => player.registrationValid !== false);
  const eligiblePlayers = t.state.roster.filter(player => player.registrationValid !== false);
  const filteredPlayers = eligiblePlayers.filter(player => {
    const matchesName = normalizePlayerName(player.name).includes(normalizePlayerName(query));
    const matchesPot = potFilter === 'all'
      || (potFilter === '__none__' && (player.pot === undefined || player.pot === null))
      || String(player.pot) === potFilter;
    return matchesName && matchesPot;
  }).sort(comparePlayersByPot);

  function change(player) {
    if (player.team === team) return t.assignPlayerToTeam(player.id, '');
    if (player.team) return toast(`Este jogador está no time ${player.team}. Para realocá-lo, remova-o pela seleção desse time.`);
    if (members.length >= 6) return toast('O time já possui 6 jogadores válidos.');
    t.assignPlayerToTeam(player.id, team);
  }

  return <div className="overlay" onClick={onClose}>
    <div className="modal team-picker-modal" onClick={event => event.stopPropagation()}>
      <button className="modal-close" aria-label="Fechar seleção de jogadores" onClick={onClose}>×</button>
      <h3>{team}</h3>
      <div className="modal-sub">Escolha até 6 jogadores com inscrição válida. Para realocar alguém, remova primeiro pela seleção do time atual.</div>
      <div className="team-picker-controls">
        <div><label htmlFor="team-player-filter">Buscar jogador</label><input id="team-player-filter" type="text" value={query} onChange={event => setQuery(event.target.value)} placeholder="Digite um nome" /></div>
        <div><label htmlFor="team-player-pot-filter">Pote de habilidade</label><select id="team-player-pot-filter" value={potFilter} onChange={event => setPotFilter(event.target.value)}>
          <option value="all">Todos os potes</option>
          {[0, 1, 2, 3, 4].map(pot => <option value={String(pot)} key={pot}>Pote {pot}</option>)}
          {eligiblePlayers.some(player => player.pot === undefined || player.pot === null) && <option value="__none__">Sem pote</option>}
        </select></div>
      </div>
      <div className="muted" style={{ margin: '8px 0' }}>{filteredPlayers.length} de {eligiblePlayers.length} jogadores encontrados · {members.length}/6 no time</div>
      <div className="pick-list">
        {filteredPlayers.map(player => <label className="pick-row" key={player.id} style={{ backgroundColor: Number.isInteger(player.pot) && POT_COLORS[player.pot] ? POT_COLORS[player.pot] : '#fff' }}>
          <span className="pick-player-name"><input type="checkbox" checked={player.team === team} disabled={Boolean(player.team && player.team !== team)} onChange={() => change(player)} style={{ width: 'auto', marginRight: 7 }} />{player.name}</span>
          <span className="pick-pot-tag">{Number.isInteger(player.pot) ? `Pote ${player.pot}` : 'Sem pote'}</span>
          <span className="team-tag">{player.team && player.team !== team ? player.team : ''}</span>
        </label>)}
        {filteredPlayers.length === 0 && <div className="empty">Nenhum jogador encontrado com os filtros selecionados.</div>}
      </div>
      <button className="btn btn-danger btn-block" style={{ marginTop: 14 }} onClick={() => { if (confirm('Excluir ' + team + '? Os jogadores ficarão sem time.')) { t.deleteTeam(team); onClose(); } }}>Excluir time</button>
    </div>
  </div>;
}





