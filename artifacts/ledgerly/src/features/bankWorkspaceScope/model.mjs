export function emptyBankWorkspace(companyId) {
  return { companyId, transactions: [], suggestions: {}, loading: true, suggestionsLoading: true,
    error: null, suggestionsError: null };
}

function verifyTransactions(rows, companyId) {
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || !row.id || row.company_id !== companyId)
      || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Invalid company transaction response');
  return rows;
}

function verifySuggestions(result) {
  const value = result?.suggestions ?? result?.data?.suggestions;
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.values(value).some(rows => !Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' ||
        !Array.isArray(row.reasons) || row.reasons.some(reason => typeof reason !== 'string')))) {
    throw new Error('Invalid suggestions response');
  }
  return value;
}

/** Legacy clients cannot abort transport. Generation checks fence every late success/failure. */
export function createBankWorkspaceReader({ companyId, loadTransactions, loadSuggestions, publish }) {
  let active = false, generation = 0, transactionVersion = 0, suggestionVersion = 0;
  let state = emptyBankWorkspace(companyId);
  const update = patch => { state = { ...state, ...patch }; publish(state); };
  const actionTicket = () => ({ companyId, generation });
  const current = ticket => active && ticket?.companyId === companyId && ticket.generation === generation;

  async function transactions() {
    if (!active) return false;
    const ticket = actionTicket(), version = ++transactionVersion;
    update({ transactions: [], loading: true, error: null });
    try {
      const rows = await loadTransactions(companyId);
      if (!current(ticket) || version !== transactionVersion) return false;
      update({ transactions: verifyTransactions(rows, companyId), loading: false, error: null });
      return true;
    } catch {
      if (current(ticket) && version === transactionVersion) update({ transactions: [], loading: false,
        error: 'Bank transactions could not be verified for this company. Retry to load the latest records.' });
      return false;
    }
  }

  async function suggestions() {
    if (!active) return false;
    const ticket = actionTicket(), version = ++suggestionVersion;
    update({ suggestions: {}, suggestionsLoading: true, suggestionsError: null });
    try {
      const result = await loadSuggestions(companyId);
      if (!current(ticket) || version !== suggestionVersion) return false;
      update({ suggestions: verifySuggestions(result), suggestionsLoading: false, suggestionsError: null });
      return true;
    } catch {
      if (current(ticket) && version === suggestionVersion) update({ suggestions: {}, suggestionsLoading: false,
        suggestionsError: 'Suggested matches could not be loaded. You can still review your transactions or retry suggestions.' });
      return false;
    }
  }

  const refresh = () => Promise.all([transactions(), suggestions()]);
  return {
    start() { active = true; generation++; state = emptyBankWorkspace(companyId); publish(state); return refresh(); },
    stop() { active = false; generation++; transactionVersion++; suggestionVersion++; },
    refresh, refreshSuggestions: suggestions, actionTicket, current,
  };
}
