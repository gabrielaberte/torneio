import React from 'react';

export default function Times({ t }) {
  if (t.teams.length === 0) {
    return <div className="empty"><div className="big">🏆</div>Cadastre times na aba Elenco.</div>;
  }
  const groupRows = t.groupStandings || [];
  const rows = groupRows.length
    ? groupRows.map(row => ({ name: row.name, points: row.points, wins: row.wins, pointDiff: row.pointDiff, rank: row.rank }))
    : t.teams.map(name => ({ name, wins: t.state.standings[name] || 0 })).sort((a, b) => b.wins - a.wins);
  const dayTwoResults = ((t.state.bracket && t.state.bracket.matches) || []).filter(match =>
    match.status === 'done' && /semi|final/i.test(match.phase || '')
  );
  return (
    <>
    <div className="card">
      <h3>{groupRows.length ? 'Classificação (pontos · vitórias · saldo)' : 'Classificação (jogos vencidos)'}</h3>
      {rows.map((r, i) => (
        <div key={r.name} className="standing-row">
          <div className="pos">{r.rank || i + 1}</div>
          <div className="tname">{r.name}</div>
          <div className="wins">{groupRows.length ? `${r.points} pts · ${r.wins}V · ${r.pointDiff} saldo` : r.wins}</div>
        </div>
      ))}
    </div>
    {dayTwoResults.length > 0 && <div className="card">
      <h3>Resultados das semifinais e finais do Dia 2</h3>
      {dayTwoResults.map(match => <div className="match-row" key={match.id}>
        <b>{match.phase}:</b> {match.teamA} {match.setsWonA ?? 0}×{match.setsWonB ?? 0} {match.teamB}
        {match.winner && <> · <span className="win">{match.winner}</span></>}
      </div>)}
    </div>}
    </>
  );
}
