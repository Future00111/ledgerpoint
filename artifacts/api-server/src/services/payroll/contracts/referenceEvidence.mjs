import { validateCaseRegistry } from '../../tax/contracts/caseRegistry.mjs';

/** Audit reference links against supplied pinned corpora. This never qualifies an engine. */
export function validatePayrollReferenceEvidence(registry, corpora) {
  validateCaseRegistry(registry);
  const fail = () => { throw new Error('INVALID_PAYROLL_REFERENCE_EVIDENCE'); };
  const rows = registry.cases.filter(row => row.referenceFixtures);
  for (const row of rows) {
    const ref = row.referenceFixtures;
    const corpus = Object.hasOwn(corpora, ref.path) ? corpora[ref.path] : null;
    const source = registry.sources[row.ruleProvenance.sourceId];
    if (!corpus || corpus.version !== 1 || corpus.taxYear !== row.selector.taxYear
      || corpus.status !== 'reference_fixtures_only_not_engine_qualification'
      || corpus.source?.page !== source.url || !/^[a-f0-9]{64}$/.test(corpus.source?.sha256)
      || !Array.isArray(corpus.cases)) fail();
    const dimension = Object.hasOwn(ref, 'plan') ? 'plan' : 'region';
    const examples = corpus.cases.filter(example => example?.input?.[dimension] === ref[dimension]);
    if (examples.length !== ref.caseCount || new Set(examples.map(example => example.id)).size !== examples.length
      || examples.some(example => typeof example.id !== 'string' || !example.id
        || example.input.taxYear !== row.selector.taxYear)) fail();
    if (ref.frequencies) {
      const actual = [...new Set(examples.map(example => example.input.frequency))].sort();
      if (JSON.stringify(actual) !== JSON.stringify([...ref.frequencies].sort())) fail();
    }
  }
  return { referenceCases: rows.length, qualifiedCases: 0 };
}
