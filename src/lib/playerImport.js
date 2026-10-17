

const COLUMNS = [
  { header: 'Nome', key: 'name', required: true },
  { header: 'Gênero', key: 'gender', required: true },
  { header: 'Inscrição validada', key: 'registrationValid', required: true },
  { header: 'Pot', key: 'pot' },
  { header: 'MVP', key: 'mvp', group: 'awards' },
  { header: 'Melhor sacador', key: 'bestServer', group: 'awards' },
  { header: 'Melhor defesa', key: 'bestDefense', group: 'awards' },
  { header: 'Melhor ataque', key: 'bestAttack', group: 'awards' },
  { header: 'Maior pontuador', key: 'topScorer', group: 'awards' },
  { header: 'Melhor bloqueio', key: 'bestBlocker', group: 'awards' },
  { header: '1º lugar', key: 'first', group: 'podiums' },
  { header: '2º lugar', key: 'second', group: 'podiums' },
  { header: '3º lugar', key: 'third', group: 'podiums' }
];

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

export function normalizePlayerName(value) {
  return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function normalizedHeader(value) {
  return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function normalizeGender(value) {
  const gender = normalizedHeader(value);
  if (gender === 'm' || gender === 'masculino') return 'M';
  if (gender === 'f' || gender === 'feminino') return 'F';
  return null;
}

function normalizeRegistration(value) {
  const registration = normalizedHeader(value);
  if (registration === 'sim') return true;
  if (registration === 'nao') return false;
  return null;
}

function parseInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  const text = cleanText(value);
  if (!text) return undefined;
  if (!/^-?\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

export async function parsePlayerWorkbook(arrayBuffer, existingPlayers = []) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('A planilha não contém uma aba para importar.');

  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: true, blankrows: false });
  if (!rows.length) throw new Error('A planilha está vazia.');

  const headerCells = rows[0].map(normalizedHeader);
  const headerMap = new Map();
  headerCells.forEach((header, index) => {
    if (header && !headerMap.has(header)) headerMap.set(header, index);
  });
  const missingHeaders = COLUMNS.filter(column => !headerMap.has(normalizedHeader(column.header)));
  if (missingHeaders.length) {
    throw new Error('Colunas obrigatórias ausentes: ' + missingHeaders.map(column => column.header).join(', '));
  }

  const existingByName = new Map();
  existingPlayers.forEach(player => {
    const key = normalizePlayerName(player.name);
    if (!key) return;
    if (!existingByName.has(key)) existingByName.set(key, []);
    existingByName.get(key).push(player);
  });

  const fileNameCounts = new Map();
  rows.slice(1).forEach(row => {
    const key = normalizePlayerName(row[headerMap.get(normalizedHeader('Nome'))]);
    if (key) fileNameCounts.set(key, (fileNameCounts.get(key) || 0) + 1);
  });

  const records = [];
  rows.slice(1).forEach((row, rowIndex) => {
    const sourceRow = rowIndex + 2;
    if (row.every(cell => cleanText(cell) === '')) return;

    const data = {};
    const errors = [];
    const nameIndex = headerMap.get(normalizedHeader('Nome'));
    const genderIndex = headerMap.get(normalizedHeader('Gênero'));
    const registrationIndex = headerMap.get(normalizedHeader('Inscrição validada'));
    const name = cleanText(row[nameIndex]);
    const gender = normalizeGender(row[genderIndex]);
    const registrationValid = normalizeRegistration(row[registrationIndex]);

    if (!name) errors.push('Nome: obrigatório.');
    if (!gender) errors.push('Gênero: informe Masculino/M ou Feminino/F.');
    if (registrationValid === null) errors.push('Inscrição validada: informe Sim ou Não.');

    data.name = name;
    data.gender = gender;
    data.registrationValid = registrationValid;

    const potIndex = headerMap.get(normalizedHeader('Pot'));
    if (potIndex !== undefined) {
      const rawPot = row[potIndex];
      const pot = parseInteger(rawPot);
      if (pot !== undefined && (pot === null || pot < 0 || pot > 4)) errors.push('Pot: informe um inteiro de 0 a 4.');
      else if (pot !== undefined) data.pot = pot;
    }

    const history = { awards: {}, podiums: {} };
    let hasHistoryValue = false;
    COLUMNS.filter(column => column.group).forEach(column => {
      const index = headerMap.get(normalizedHeader(column.header));
      if (index === undefined) return;
      const value = parseInteger(row[index]);
      if (value === undefined) return;
      if (value === null || value < 0) {
        errors.push(column.header + ': informe um inteiro não negativo.');
        return;
      }
      history[column.group][column.key] = value;
      hasHistoryValue = true;
    });
    if (hasHistoryValue) data.scoutingHistory = history;

    const key = normalizePlayerName(name);
    const matches = key ? (existingByName.get(key) || []) : [];
    const duplicateInFile = key && fileNameCounts.get(key) > 1;
    records.push({
      sourceRow,
      data,
      errors,
      duplicate: Boolean(matches.length || duplicateInFile),
      duplicateNames: matches.map(player => player.name),
      duplicateMatches: matches.map(player => ({ id: player.id, name: player.name })),
      duplicateInFile: Boolean(duplicateInFile),
      valid: errors.length === 0
    });
  });

  return {
    records,
    validCount: records.filter(record => record.valid).length,
    errorCount: records.filter(record => !record.valid).length,
    duplicateCount: records.filter(record => record.duplicate).length,
    skippedEmptyRows: rows.slice(1).filter(row => row.every(cell => cleanText(cell) === '')).length
  };
}



