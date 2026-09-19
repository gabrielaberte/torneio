import React from 'react';

export default function Times({ t }) {
  if (t.teams.length === 0) {
    return <div className="empty"><div className="big">🏆</div>Cadastre times na aba Elenco.</div>;
  }
  const rows = t.teams.map(name => ({ name, wins: t.state.standings[name] || 0 })).sort((a, b) => b.wins - a.wins);
  return (
    <div className="card">
      <h3>Classificação (jogos vencidos)</h3>
      {rows.map((r, i) => (
        <div key={r.name} className="standing-row">
          <div className="pos">{i + 1}</div>
          <div className="tname">{r.name}</div>
          <div className="wins">{r.wins}</div>
        </div>
      ))}
    </div>
  );
}
