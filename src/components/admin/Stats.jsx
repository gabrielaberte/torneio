import React from 'react';

function topN(t, key, n, filterGender) {
  let arr = t.state.roster.map(p => ({ id: p.id, name: p.name, gender: p.gender, val: t.getStats(p.id)[key] || 0 }));
  if (filterGender) arr = arr.filter(p => p.gender === filterGender);
  arr = arr.filter(p => p.val > 0);
  arr.sort((a, b) => b.val - a.val);
  return arr.slice(0, n);
}
const MEDALS = ['🥇', '🥈', '🥉'];

function AwardCard({ t, title, statKey, n = 3, gender, bad }) {
  const list = topN(t, statKey, n, gender);
  return (
    <div className={`award-card ${bad ? 'bad-award' : ''}`}>
      <div className="a-label">{title}</div>
      {list.length ? list.map((p, i) => (
        <div key={p.id} className="a-row"><span className="medal">{MEDALS[i]}</span><span className="aname">{p.name}</span><span className="aval">{p.val}</span></div>
      )) : <div className="muted" style={{ fontSize: 12 }}>Sem dados ainda</div>}
    </div>
  );
}

function StatTable({ t }) {
  const goodKeys = ['points', 'aces', 'attacksGood', 'blocks', 'drops'];
  const badKeys = ['attacksBad', 'netTouches', 'serveErrors', 'mishits'];
  const rankMap = {};
  [...goodKeys, ...badKeys].forEach(k => {
    const sorted = t.state.roster.map(p => ({ id: p.id, val: t.getStats(p.id)[k] || 0 })).filter(p => p.val > 0).sort((a, b) => b.val - a.val);
    rankMap[k] = {};
    sorted.slice(0, 3).forEach((p, i) => { rankMap[k][p.id] = i + 1; });
  });
  const cols = [
    ['points', 'Pts'], ['aces', 'Ace'], ['attacksGood', 'Atq✓'], ['attacksBad', 'Atq✗'],
    ['blocks', 'Blq'], ['netTouches', 'Rede'], ['serveErrors', 'Saq✗'], ['mishits', 'Quin'], ['drops', 'Larg'], ['mvp', 'MVP']
  ];
  const sortedRoster = [...t.state.roster].sort((a, b) => (t.getStats(b.id).points || 0) - (t.getStats(a.id).points || 0));
  return (
    <div className="table-scroll">
      <table className="stat-table">
        <thead><tr><th>Jogador</th>{cols.map(c => <th key={c[0]}>{c[1]}</th>)}</tr></thead>
        <tbody>
          {sortedRoster.map(p => {
            const s = t.getStats(p.id);
            return (
              <tr key={p.id}>
                <td>{p.name}<br /><span style={{ fontSize: 9, color: 'rgba(15,42,61,.5)' }}>{p.team}</span></td>
                {cols.map(c => {
                  const val = s[c[0]] || 0;
                  const good = goodKeys.includes(c[0]);
                  const bad = badKeys.includes(c[0]);
                  let cls = '';
                  if (good && rankMap[c[0]][p.id]) cls = 'rank-' + rankMap[c[0]][p.id];
                  if (bad && rankMap[c[0]][p.id]) cls = 'badrank-' + rankMap[c[0]][p.id];
                  return <td key={c[0]} className={cls}>{val}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Stats({ t }) {
  if (t.state.roster.length === 0) {
    return <div className="empty"><div className="big">📊</div>Cadastre participantes e jogue partidas para ver as estatísticas.</div>;
  }
  return (
    <>
      <div className="section-title">Prêmios · categorias boas</div>
      <div className="award-grid">
        <AwardCard t={t} title="Maior Pontuador Geral" statKey="points" />
        <AwardCard t={t} title="Maior Pontuador Masc." statKey="points" gender="M" />
        <AwardCard t={t} title="Maior Pontuadora Fem." statKey="points" gender="F" />
        <AwardCard t={t} title="Melhor Saque Geral" statKey="aces" />
        <AwardCard t={t} title="Melhor Saque Masc." statKey="aces" gender="M" />
        <AwardCard t={t} title="Melhor Saque Fem." statKey="aces" gender="F" />
        <AwardCard t={t} title="Melhor Ataque Geral" statKey="attacksGood" />
        <AwardCard t={t} title="Melhor Ataque Masc." statKey="attacksGood" gender="M" />
        <AwardCard t={t} title="Melhor Ataque Fem." statKey="attacksGood" gender="F" />
        <AwardCard t={t} title="Melhor Bloqueio" statKey="blocks" />
      </div>
      <div className="section-title">Categorias a melhorar</div>
      <div className="award-grid">
        <AwardCard t={t} title="Mais Quinadas" statKey="mishits" bad />
        <AwardCard t={t} title="Mais Erros de Saque" statKey="serveErrors" bad />
        <AwardCard t={t} title="Mais Toques na Rede" statKey="netTouches" bad />
      </div>
      <div className="section-title">Tabela geral</div>
      <div className="card"><StatTable t={t} /></div>
    </>
  );
}
