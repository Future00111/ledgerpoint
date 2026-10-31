import { validateCaseRegistry } from '../../tax/contracts/caseRegistry.mjs';

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactMoney = value => typeof value === 'string' && /^-?(0|[1-9][0-9]*)$/.test(value) && value !== '-0';
const nonnegativeMoney = value => exactMoney(value) && !value.startsWith('-');
function validExample(example, dimension) {
  if (!plain(example) || !plain(example.input) || !plain(example.expected)
    || typeof example.id !== 'string' || !example.id
    || typeof example.sourceSheet !== 'string' || !example.sourceSheet
    || !Number.isSafeInteger(example.sourceRow) || example.sourceRow <= 0) return false;
  const { input, expected } = example;
  if (dimension === 'plan') return ['weekly', 'fortnightly', 'four_weekly', 'monthly'].includes(input.frequency)
    && nonnegativeMoney(input.payMinor) && Object.keys(expected).length === 1
    && nonnegativeMoney(expected.deductionMinor);
  return ['weekly', 'monthly'].includes(input.frequency)
    && Number.isSafeInteger(input.period) && input.period > 0
    && typeof input.taxCode === 'string' && input.taxCode.length > 0
    && exactMoney(input.grossPayMinor) && exactMoney(input.taxablePayToDateMinor)
    && Object.keys(expected).length === 2
    && exactMoney(expected.taxDueMinor) && exactMoney(expected.taxDueToDateMinor);
}

// PAYE references include cumulative examples and retain workbook row sequences.
// Preserve that lineage without inferring calculation rules from row order.
function validPayeSequences(corpus) {
  const workbooks = corpus.source?.workbooks;
  if (!Array.isArray(workbooks) || workbooks.length === 0
    || workbooks.some(book => !plain(book) || typeof book.path !== 'string' || !book.path
      || !['rest_of_uk', 'scotland', 'wales'].includes(book.region)
      || !/^[a-f0-9]{64}$/.test(book.sha256))
    || new Set(workbooks.map(book => book.path)).size !== workbooks.length) return false;
  const previous = new Map();
  for (const example of corpus.cases) {
    if (!validExample(example, 'region')) return false;
    const book = workbooks.find(book => book.path === example.sourceWorkbook);
    const prior = previous.get(example.sequenceId);
    if (!book || book.region !== example.input.region
      || example.sequenceId !== `${example.input.region}/${example.sourceSheet}`
      || ![null, 'WM1'].includes(example.input.week1Month1)
      || example.previousExampleId !== (prior?.id ?? null)
      || prior && (example.sourceWorkbook !== prior.sourceWorkbook
        || example.input.frequency !== prior.input.frequency
        || example.input.week1Month1 !== prior.input.week1Month1
        || example.sourceRow <= prior.sourceRow)) return false;
    previous.set(example.sequenceId, example);
  }
  return true;
}

/** Audit reference links against supplied pinned corpora. This never qualifies an engine. */
export function validatePayrollReferenceEvidence(registry, corpora) {
  validateCaseRegistry(registry);
  const fail = () => { throw new Error('INVALID_PAYROLL_REFERENCE_EVIDENCE'); };
  if (!plain(corpora)) fail();
  const rows = registry.cases.filter(row => row.referenceFixtures);
  const coverage = new Map();
  const auditedSequences = new Set();
  for (const row of rows) {
    const ref = row.referenceFixtures;
    const corpus = Object.hasOwn(corpora, ref.path) ? corpora[ref.path] : null;
    const source = registry.sources[row.ruleProvenance.sourceId];
    if (!corpus || corpus.version !== 1 || corpus.taxYear !== row.selector.taxYear
      || corpus.status !== 'reference_fixtures_only_not_engine_qualification'
      || corpus.source?.page !== source.url || !/^[a-f0-9]{64}$/.test(corpus.source?.sha256)
      || !Array.isArray(corpus.cases)) fail();
    const dimension = Object.hasOwn(ref, 'plan') ? 'plan' : 'region';
    if (dimension === 'region' && !auditedSequences.has(ref.path)) {
      if (!validPayeSequences(corpus)) fail();
      auditedSequences.add(ref.path);
    }
    const covered = coverage.get(ref.path) ?? new Set();
    coverage.set(ref.path, covered);
    const examples = corpus.cases.filter(example => example?.input?.[dimension] === ref[dimension]);
    if (examples.length !== ref.caseCount || new Set(examples.map(example => example.id)).size !== examples.length
      || examples.some(example => !validExample(example, dimension) || covered.has(example.id)
        || example.input.taxYear !== row.selector.taxYear)) fail();
    examples.forEach(example => covered.add(example.id));
    if (ref.frequencies) {
      const actual = [...new Set(examples.map(example => example.input.frequency))].sort();
      if (JSON.stringify(actual) !== JSON.stringify([...ref.frequencies].sort())) fail();
    }
  }
  // No orphan reference data may silently disappear from declared coverage.
  // This checks only linked corpora; unrelated supplied corpora are not evidence.
  for (const [path, ids] of coverage) {
    if (corpora[path].cases.length !== ids.size) fail();
  }
  return { referenceCases: rows.length, qualifiedCases: 0 };
}
