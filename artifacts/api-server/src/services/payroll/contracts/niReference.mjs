/** Reference lookup only, not an NI calculator or eligibility decision.
 * Source-anomalous examples must never become executable engine expectations.
 */
export function selectNiReference(corpus, id, taxYear) {
  if (taxYear !== '2026-27' || corpus?.taxYear !== taxYear ||
      corpus?.status !== 'reference_fixtures_only_not_engine_qualification') {
    return { ok: false, code: 'NI_REFERENCE_YEAR_OR_STATUS_INVALID' };
  }
  const matches = corpus.cases?.filter(c => c.id === id);
  if (!matches || matches.length !== 1) return { ok: false, code: 'NI_REFERENCE_NOT_UNIQUE' };
  const row = matches[0];
  if (row.input?.taxYear !== taxYear || row.input?.period !== 1 ||
      row.sourceNumericLexemes?.C !== '1' || !Array.isArray(row.sourceIssues) || row.sourceIssues.length) {
    return { ok: false, code: 'NI_REFERENCE_REQUIRES_SOURCE_CLARIFICATION' };
  }
  return { ok: true, referenceOnly: true, engineQualified: false, example: structuredClone(row) };
}
