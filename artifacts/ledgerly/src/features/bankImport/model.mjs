// Import review only. The server remains authoritative for access and recording.
export const MAX_CSV_BYTES = 1024 * 1024;
export const MAX_CSV_ROWS = 1000;
export const MAX_CSV_COLUMNS = 50;
const MAX_FIELD_LENGTH = 4096;
const MAX_PENCE = 999999999999n; // Existing bank numeric(12, 2) boundary.
export const FIELDS = ['date', 'description', 'reference', 'money_in', 'money_out', 'balance'];
const HEADER_MAP = {
  date: 'date', 'transaction date': 'date', transaction_date: 'date',
  description: 'description', details: 'description', narrative: 'description', memo: 'description',
  reference: 'reference', ref: 'reference',
  'money in': 'money_in', credit: 'money_in', deposit: 'money_in', money_in: 'money_in',
  'money out': 'money_out', debit: 'money_out', payment: 'money_out', money_out: 'money_out', balance: 'balance',
};

export function checkFileSize(size) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_CSV_BYTES) throw new Error('Choose a non-empty CSV up to 1 MiB.');
}

export function parseBankCSV(text) {
  if (typeof text !== 'string') throw new Error('The CSV could not be read.');
  checkFileSize(new TextEncoder().encode(text).length);
  const input = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const pushField = () => {
    if (field.length > MAX_FIELD_LENGTH) throw new Error('A CSV field exceeds 4,096 characters.');
    row.push(field); field = ''; closed = false;
    if (row.length > MAX_CSV_COLUMNS) throw new Error('Use a CSV with no more than 50 columns.');
  };
  const pushRow = () => {
    pushField();
    if (row.some(value => value.trim())) rows.push(row);
    row = [];
    if (rows.length > MAX_CSV_ROWS + 1) throw new Error('Import no more than 1,000 transactions at a time.');
  };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '\0') throw new Error('The CSV contains an unsupported null character.');
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === ',') pushField();
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      pushRow();
    } else if (closed) throw new Error('Unexpected text after a closing CSV quote.');
    else if (char === '"') {
      if (field) throw new Error('A CSV quote must start at the beginning of a field.');
      quoted = true;
    } else field += char;
    if (field.length > MAX_FIELD_LENGTH) throw new Error('A CSV field exceeds 4,096 characters.');
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  if (field || row.length || closed) pushRow();
  if (rows.length < 2) throw new Error('Include a header and at least one transaction.');
  const headers = rows[0].map(value => value.trim());
  if (headers.some(value => !value)) throw new Error('Every CSV column needs a header.');
  const columnMap = {};
  headers.forEach((value, index) => {
    const mapped = Object.hasOwn(HEADER_MAP, value.toLowerCase()) ? HEADER_MAP[value.toLowerCase()] : null;
    if (mapped) columnMap[index] = mapped;
  });
  return { headers, rows: rows.slice(1), columnMap };
}

export function parseStatementDate(value, format = 'iso') {
  const raw = String(value ?? '').trim();
  let iso;
  if (format === 'iso' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) iso = raw;
  else if (format === 'dmy' && /^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/'); iso = `${year}-${month}-${day}`;
  } else throw new Error(format === 'dmy' ? 'Use DD/MM/YYYY dates.' : 'Use YYYY-MM-DD dates, or explicitly choose DD/MM/YYYY.');
  const date = new Date(`${iso}T00:00:00Z`);
  if (iso < '1900-01-01' || iso > '2199-12-31' || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== iso) throw new Error('Enter a real date between 1900 and 2199.');
  return iso;
}

export function parseStatementMoney(value, { negative = false, blank = 'zero' } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (blank === 'null') return null;
    return { pence: '0', decimal: '0.00', number: 0 };
  }
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) throw new Error('Use a decimal amount with at most two decimal places (for example 1,234.56).');
  if (raw.startsWith('-') && !negative) throw new Error('Money in/out cannot be negative; use the opposite column.');
  const [whole, fraction = ''] = raw.replace(/,/g, '').replace(/^-/, '').split('.');
  const absolute = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (absolute > MAX_PENCE) throw new Error('The amount exceeds the supported bank-record limit of 9,999,999,999.99.');
  const pence = raw.startsWith('-') ? -absolute : absolute;
  const decimal = `${pence < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
  const number = Number(decimal);
  // Existing import API converts numbers to pence. Verify exactly that boundary.
  if (!Number.isFinite(number) || BigInt(Math.round(number * 100)) !== pence || number.toFixed(2) !== decimal) throw new Error('This amount cannot be represented exactly by the current import API.');
  return { pence: String(pence), decimal, number };
}

export function validateMapping(headers, columnMap) {
  const mapped = Object.entries(columnMap).filter(([, field]) => field && field !== 'skip');
  if (mapped.some(([index, field]) => !/^\d+$/.test(index) || Number(index) >= headers.length || !FIELDS.includes(field))) throw new Error('Choose valid column mappings.');
  const fields = mapped.map(([, field]) => field);
  if (new Set(fields).size !== fields.length) throw new Error('Map each transaction field only once.');
  if (!fields.includes('date') || !fields.includes('description') || !fields.some(field => ['money_in', 'money_out'].includes(field))) throw new Error('Map Date, Description and at least one Money in/out column.');
}

export function buildBankPreview({ headers, rows, columnMap, dateFormat, companyId, bankAccountId }) {
  validateMapping(headers, columnMap);
  if (!companyId || !bankAccountId) throw new Error('Select an authorised bank account first.');
  if (!rows.length || rows.length > MAX_CSV_ROWS) throw new Error('Review between 1 and 1,000 transactions.');
  const transactions = [], errors = [];
  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    try {
      if (row.length !== headers.length) throw new Error(`Expected ${headers.length} columns; found ${row.length}.`);
      const mapped = {};
      for (const [column, field] of Object.entries(columnMap)) if (field && field !== 'skip') mapped[field] = row[Number(column)].trim();
      const date = parseStatementDate(mapped.date, dateFormat);
      if (!mapped.description || mapped.description.length > 1000) throw new Error('Description must contain 1-1,000 characters.');
      if ((mapped.reference?.length ?? 0) > 1000) throw new Error('Reference must be at most 1,000 characters.');
      const moneyIn = parseStatementMoney(mapped.money_in), moneyOut = parseStatementMoney(mapped.money_out);
      if ((moneyIn.pence !== '0') === (moneyOut.pence !== '0')) throw new Error('Enter a positive amount in exactly one of Money in or Money out.');
      const balance = parseStatementMoney(mapped.balance, { negative: true, blank: 'null' });
      transactions.push({ sourceRow, inDecimal: moneyIn.decimal, outDecimal: moneyOut.decimal,
        payload: { company_id: companyId, bank_account_id: bankAccountId, date, description: mapped.description,
          reference: mapped.reference || '', money_in: moneyIn.number, money_out: moneyOut.number,
          balance: balance?.decimal ?? null, type: moneyIn.pence !== '0' ? 'income' : 'expense' } });
    } catch (error) { errors.push({ row: sourceRow, message: error.message }); }
  });
  return { transactions: errors.length ? [] : transactions, errors };
}

function candidateKey(record) {
  try {
    const date = parseStatementDate(record.date);
    const incoming = parseStatementMoney(record.money_in), outgoing = parseStatementMoney(record.money_out);
    return JSON.stringify([date, String(record.description ?? '').trim().toLocaleLowerCase('en-GB'),
      String(record.reference ?? '').trim().toLocaleLowerCase('en-GB'), incoming.pence, outgoing.pence]);
  } catch { return null; }
}
/** Same values are a warning, not a transaction identity and never automatic deletion. */
export function markDuplicateCandidates(transactions, existing) {
  const keys = new Set(existing.map(candidateKey).filter(Boolean));
  const counts = new Map();
  for (const transaction of transactions) { const key = candidateKey(transaction.payload); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return transactions.map(transaction => {
    const key = candidateKey(transaction.payload);
    return { ...transaction, possibleDuplicate: keys.has(key) || counts.get(key) > 1 };
  });
}

export function confirmedImportReceipt(receipt, selected, companyId, bankAccountId) {
  if (receipt?.success !== true || !Array.isArray(receipt.data) || receipt.data.length !== selected.length ||
      receipt.data.some(row => !row?.id || row.company_id !== companyId || row.bank_account_id !== bankAccountId) ||
      new Set(receipt.data.map(row => row.id)).size !== selected.length) throw new Error('Unverified import receipt');
  return { count: receipt.data.length, analysisStatus: receipt.analysis_status };
}

/** Ignore stale reads after a new file, a company change, dialog close or unmount. */
export function createImportGate() {
  let version = 0;
  return {
    begin: key => ({ key, version: ++version }),
    current: (ticket, key) => ticket.key === key && ticket.version === version,
    cancel: () => { version++; },
  };
}
