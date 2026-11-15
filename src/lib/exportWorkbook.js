const STAT_FIELDS = [
  ['points', 'Pontos'],
  ['aces', 'Aces'],
  ['attacksGood', 'Ataques certos'],
  ['attacksBad', 'Erros de ataque'],
  ['blocks', 'Bloqueios'],
  ['netTouches', 'Toques na rede'],
  ['serveErrors', 'Erros de saque'],
  ['mishits', 'Quinadas'],
  ['drops', 'Largadas/outros'],
  ['mvp', 'MVP']
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(match, isCurrent = false) {
  if (isCurrent) return match.finished ? 'Aguardando finalizacao' : 'Em andamento';
  if (match.status === 'done' || match.winner) return 'Finalizado';
  if (match.status === 'live') return 'Em andamento';
  if (match.status === 'scheduled') return 'Agendado';
  return match.status || '';
}

function matchPlayers(match, roster) {
  const byId = new Map(roster.map(player => [String(player.id), player]));
  const ids = new Set(Object.keys(match.matchStats || {}));
  roster.filter(player => player.team === match.teamA || player.team === match.teamB)
    .forEach(player => ids.add(String(player.id)));
  return [...ids].map(id => byId.get(id) || { id, name: 'Atleta removido', team: '' });
}

function buildGamesRows(state) {
  const history = Array.isArray(state.history) ? state.history : [];
  const fixtures = (state.bracket && Array.isArray(state.bracket.matches)) ? state.bracket.matches : [];
  const roster = Array.isArray(state.roster) ? state.roster : [];
  const current = state.current;
  const usedHistory = new Set();
  const games = fixtures.map(fixture => {
    const completed = history.find(item => item.bracketMatchId && item.bracketMatchId === fixture.id);
    if (completed) usedHistory.add(completed);
    const active = current && current.bracketMatchId === fixture.id ? current : null;
    return { ...fixture, ...(completed || {}), ...(active || {}), isCurrent: Boolean(active) };
  });
  history.filter(match => !usedHistory.has(match)).forEach(match => games.push({ ...match, status: 'done' }));
  if (current && !current.bracketMatchId) games.push({ ...current, status: 'live', isCurrent: true });

  const headers = [
    'Jogo', 'Fase', 'Status', 'Tipo', 'Time A', 'Time B', 'Vencedor',
    'Sets do Time A', 'Sets do Time B', 'Melhor de', 'Pontos sets normais', 'Pontos set decisivo',
    'Parciais dos sets', 'Data agendada', 'MVP', 'Atleta', 'Time do atleta', ...STAT_FIELDS.map(field => field[1])
  ];
  const rows = [headers];
  games.forEach((game, index) => {
    const partials = (game.sets || []).map(set => number(set.a) + '-' + number(set.b));
    if (game.isCurrent && game.currentSet && (number(game.currentSet.a) || number(game.currentSet.b))) {
      partials.push('Parcial: ' + number(game.currentSet.a) + '-' + number(game.currentSet.b));
    }
    const players = statusLabel(game, game.isCurrent) === 'Agendado' ? [] : matchPlayers(game, roster);
    const entries = players.length ? players : [null];
    entries.forEach(player => {
      const stats = player && game.matchStats ? (game.matchStats[player.id] || {}) : {};
      rows.push([
        index + 1, game.phase || '', statusLabel(game, game.isCurrent), game.isPractice ? 'Treino' : 'Oficial',
        game.teamA || '', game.teamB || '', game.winner || '',
        game.setsWonA ?? '', game.setsWonB ?? '', game.bestOf ?? '', game.target ?? '', game.decidingTarget ?? game.target ?? '',
        partials.join(' | '), game.scheduledAt || '', game.mvpName || '',
        player ? player.name : '', player ? player.team : '',
        ...STAT_FIELDS.map(([key]) => number(stats[key]))
      ]);
    });
  });
  return rows;
}

function buildStatsRows(state, teams, groupStandings) {
  const roster = Array.isArray(state.roster) ? state.roster : [];
  const playerStats = state.playerStats || {};
  const matches = Array.isArray(state.history) ? state.history : [];
  const rows = [['CLASSIFICACAO GERAL']];
  if (groupStandings && groupStandings.length) {
    rows.push(['Posicao', 'Time', 'Pontos', 'Vitorias', 'Saldo de pontos', 'Jogos disputados']);
    groupStandings.forEach(row => rows.push([row.rank, row.name, row.points, row.wins, row.pointDiff, row.played]));
  } else {
    const teamRows = [...new Set([...(teams || []), ...roster.map(player => player.team)].filter(Boolean))]
      .map(name => {
        const played = matches.filter(match => match.teamA === name || match.teamB === name).length;
        const wins = number(state.standings && state.standings[name]);
        return { name, played, wins, losses: Math.max(0, played - wins) };
      }).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, 'pt-BR'));
    rows.push(['Posicao', 'Time', 'Vitorias', 'Derrotas', 'Jogos disputados']);
    teamRows.forEach((row, index) => rows.push([index + 1, row.name, row.wins, row.losses, row.played]));
  }

  const categories = [
    { title: 'Maior pontuador geral', key: 'points' },
    { title: 'Maior pontuador masculino', key: 'points', gender: 'M' },
    { title: 'Maior pontuadora feminina', key: 'points', gender: 'F' },
    { title: 'Melhor saque geral', key: 'aces' },
    { title: 'Melhor saque masculino', key: 'aces', gender: 'M' },
    { title: 'Melhor saque feminino', key: 'aces', gender: 'F' },
    { title: 'Melhor ataque geral', key: 'attacksGood' },
    { title: 'Melhor ataque masculino', key: 'attacksGood', gender: 'M' },
    { title: 'Melhor ataque feminino', key: 'attacksGood', gender: 'F' },
    { title: 'Melhor bloqueio', key: 'blocks' },
    { title: 'Mais quinadas', key: 'mishits' },
    { title: 'Mais erros de saque', key: 'serveErrors' },
    { title: 'Mais toques na rede', key: 'netTouches' }
  ];
  rows.push([], ['MELHORES E PIORES PONTUACOES'], ['Categoria', 'Posicao', 'Atleta', 'Time', 'Valor']);
  categories.forEach(category => {
    roster.map(player => ({
      player,
      value: number(playerStats[player.id] && playerStats[player.id][category.key])
    })).filter(entry => entry.value > 0 && (!category.gender || entry.player.gender === category.gender))
      .sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name, 'pt-BR'))
      .slice(0, 3)
      .forEach((entry, index) => rows.push([
        category.title, index + 1, entry.player.name, entry.player.team || '', entry.value
      ]));
  });

  rows.push([], ['ESTATISTICAS GERAIS DE TODOS OS ATLETAS']);
  rows.push(['Atleta', 'Time', 'Genero', ...STAT_FIELDS.map(field => field[1])]);
  [...roster].sort((a, b) => number(playerStats[b.id] && playerStats[b.id].points) - number(playerStats[a.id] && playerStats[a.id].points)
    || a.name.localeCompare(b.name, 'pt-BR'))
    .forEach(player => rows.push([
      player.name || '', player.team || '', player.gender || '',
      ...STAT_FIELDS.map(([key]) => number(playerStats[player.id] && playerStats[player.id][key]))
    ]));
  return rows;
}

function columnsFor(widths) {
  return widths.map(width => ({ wch: width }));
}

export async function downloadTournamentWorkbook({ eventName, state, teams, groupStandings }) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const roster = Array.isArray(state.roster) ? state.roster : [];
  const rosterRows = [[
    'ID', 'Nome', 'Time', 'Genero', 'Inscricao validada', 'Capitao', 'Pote'
  ], ...roster.map(player => [
    player.id || '', player.name || '', player.team || '', player.gender || '',
    player.registrationValid === false ? 'Nao' : 'Sim',
    player.isCaptain ? 'Sim' : 'Nao',
    player.pot == null ? '' : player.pot + 1
  ])];
  const rosterSheet = XLSX.utils.aoa_to_sheet(rosterRows);
  rosterSheet['!cols'] = columnsFor([18, 30, 24, 14, 20, 12, 10]);
  rosterSheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rosterRows.length - 1, 0), c: rosterRows[0].length - 1 } }) };
  XLSX.utils.book_append_sheet(workbook, rosterSheet, 'Elenco');

  const gamesRows = buildGamesRows(state);
  const gamesSheet = XLSX.utils.aoa_to_sheet(gamesRows);
  gamesSheet['!cols'] = columnsFor([8, 20, 22, 14, 24, 24, 24, 14, 14, 12, 18, 20, 28, 22, 24, 28, 24, ...STAT_FIELDS.map(() => 16)]);
  if (gamesRows.length > 1) gamesSheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: gamesRows.length - 1, c: gamesRows[0].length - 1 } }) };
  XLSX.utils.book_append_sheet(workbook, gamesSheet, 'Jogos');

  const statsRows = buildStatsRows(state, teams, groupStandings);
  const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
  statsSheet['!cols'] = columnsFor([32, 28, 18, 18, 20, 22, ...STAT_FIELDS.map(() => 16)]);
  XLSX.utils.book_append_sheet(workbook, statsSheet, 'Estatisticas');

  const safeName = String(eventName || 'torneio').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'torneio';
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, safeName + '-backup-' + date + '.xlsx');
}
