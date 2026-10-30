import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PENCE, money } from '../financialDrafts/contract';
import { appliedTo, settlementAmounts } from './settlement';
import {
  DocumentProjectionError, projectDocumentAsOf,
  type DocumentAmounts, type DocumentMoneySnapshot, type DocumentProjectionInput, type FinancialDocumentAmendment,
  type PostedDocumentOrigin, type ProjectedDocumentKind,
} from './documentEvents';

const uuid = (n: number) => `a0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const company = uuid(1), document = uuid(2), context = `sha256:${'ab'.repeat(32)}`;
const fields = ['net_pence', 'vat_pence', 'gross_pence'] as const;

// The native money composer receives already-authoritative VAT fixtures. The
// projection never infers a rate or repeats inclusive/discount tax calculation.
function amounts(nets: bigint[], vats: string[], refs = nets.map((_, i) => i)): DocumentMoneySnapshot {
  const { currency: _currency, ...result } = money(nets, vats);
  return { ...result, lines: result.lines.map((line, i) => ({ ...line, original_line_ref: refs[i]! })) };
}
function origin(value = amounts([10000n], ['2000']), kind: ProjectedDocumentKind = 'sales_invoice'): PostedDocumentOrigin {
  return { company_id: company, document_id: document, kind, currency: 'GBP', status: 'posted',
    revision: uuid(3), effective_date: '2026-01-01', journal_id: uuid(4), financial_context_hash: context, money: value };
}
function difference(before: DocumentMoneySnapshot, after: DocumentMoneySnapshot): DocumentMoneySnapshot {
  const subtract = (a: DocumentAmounts, b: DocumentAmounts) => ({
    net_pence: (BigInt(b.net_pence) - BigInt(a.net_pence)).toString(),
    vat_pence: (BigInt(b.vat_pence) - BigInt(a.vat_pence)).toString(),
    gross_pence: (BigInt(b.gross_pence) - BigInt(a.gross_pence)).toString(),
  });
  return { ...subtract(before, after), lines: before.lines.map((line, i) => ({
    original_line_ref: line.original_line_ref,
    ...subtract(line, after.lines[i]!),
  })) };
}
function amend(previous: PostedDocumentOrigin | FinancialDocumentAmendment, after: DocumentMoneySnapshot,
  effective_date = '2026-02-01', index = 1): FinancialDocumentAmendment {
  const before = 'money' in previous ? previous.money : previous.after;
  return { company_id: company, document_id: document, kind: 'financial_correction', status: 'posted',
    event_id: uuid(10 * index), request_id: uuid(10 * index + 1), revision: uuid(10 * index + 2),
    journal_id: uuid(10 * index + 3), previous_revision: previous.revision, effective_date,
    financial_context_hash: context, before, after, delta: difference(before, after) };
}
function history(original = origin(), amendments: FinancialDocumentAmendment[] = [], as_of = '2026-12-31'): DocumentProjectionInput {
  return { company_id: company, document_id: document, as_of, original, amendments,
    head_revision: amendments.at(-1)?.revision ?? original.revision };
}
function corrected() {
  const original = origin();
  const first = amend(original, amounts([9000n], ['1800']));
  const second = amend(first, amounts([9500n], ['1900']), '2026-03-01', 2);
  return history(original, [first, second]);
}
function rejects(input: unknown, code: DocumentProjectionError['code'], path?: string) {
  assert.throws(() => projectDocumentAsOf(input), (error: unknown) => {
    assert.ok(error instanceof DocumentProjectionError);
    assert.equal(error.code, code);
    assert.equal(error.message, `DOCUMENT_PROJECTION_${code}`);
    if (path !== undefined) assert.equal(error.path, path);
    return true;
  });
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

test('original document exists on its posting date, but no financial amount exists before it', () => {
  const source = corrected();
  for (const as_of of ['0001-01-01', '2025-12-31']) {
    const result = projectDocumentAsOf({ ...source, as_of });
    assert.equal(result.exists, false);
    assert.equal(result.money, null);
    assert.equal(result.financial_revision, null);
    assert.deepEqual(result.movements, []);
    assert.deepEqual(result.included_amendment_ids, []);
    assert.deepEqual(result.excluded_amendment_ids, source.amendments.map(e => e.event_id));
  }
  const onDate = projectDocumentAsOf({ ...source, as_of: '2026-01-01' });
  assert.equal(onDate.exists, true);
  assert.deepEqual(onDate.money, source.original.money);
  assert.equal(onDate.financial_revision, source.original.revision);
  assert.equal(onDate.movements[0]!.journal_id, source.original.journal_id);
  assert.equal(onDate.movements[0]!.event_id, null);
  assert.deepEqual(projectDocumentAsOf(history()).money, origin().money);
});

test('£120 corrected to £108 with £50 paid has £58 due using existing settlement semantics', () => {
  const original = origin();
  const event = amend(original, amounts([9000n], ['1800']));
  const payments = freezeDeep([{ id: uuid(100), kind: 'payment', amount_minor: '5000',
    allocations: [{ document_id: document, amount_minor: '5000' }] }]);
  const beforePayments = JSON.stringify(payments);
  const paid = appliedTo(payments, document).toString();
  const old = projectDocumentAsOf(history(original, [event], '2026-01-31'));
  const updated = projectDocumentAsOf(history(original, [event], '2026-02-01'));
  assert.equal(settlementAmounts(old.money!.gross_pence, '0', paid).open_minor, '7000');
  assert.deepEqual(settlementAmounts(updated.money!.gross_pence, '0', paid), {
    gross_minor: '10800', credited_minor: '0', paid_minor: '5000', open_minor: '5800', settlement: 'part_paid',
  });
  assert.deepEqual(updated.movements[1]!.delta, {
    net_pence: '-1000', vat_pence: '-200', gross_pence: '-1200',
    lines: [{ original_line_ref: 0, net_pence: '-1000', vat_pence: '-200', gross_pence: '-1200' }],
  });
  assert.equal(original.money.gross_pence, '12000');
  assert.equal(JSON.stringify(payments), beforePayments);
});

test('dated signed movements reconcile every historical net, VAT and gross projection', () => {
  const source = corrected();
  const cases = [
    ['2026-01-31', '12000', 1], ['2026-02-01', '10800', 2],
    ['2026-02-28', '10800', 2], ['2026-03-01', '11400', 3], ['9999-12-31', '11400', 3],
  ] as const;
  for (const [as_of, gross, count] of cases) {
    const result = projectDocumentAsOf({ ...source, as_of });
    assert.equal(result.money!.gross_pence, gross);
    assert.equal(result.movements.length, count);
    assert.equal(result.included_amendment_ids.length + result.excluded_amendment_ids.length, 2);
    for (const field of fields) {
      assert.equal(result.movements.reduce((sum, movement) => sum + BigInt(movement.delta[field]), 0n).toString(), result.money![field]);
    }
    for (const movement of result.movements) {
      assert.equal(BigInt(movement.delta.net_pence) + BigInt(movement.delta.vat_pence), BigInt(movement.delta.gross_pence));
    }
  }
  const result = projectDocumentAsOf(source);
  assert.equal(result.movements[2]!.delta.gross_pence, '600');
  assert.equal(result.original_revision, source.original.revision);
  assert.equal(result.financial_revision, source.head_revision);
});

test('same-day corrections retain the validated revision order rather than sorting IDs', () => {
  const original = origin();
  const first = amend(original, amounts([9000n], ['1800']), '2026-01-01', 2);
  const second = amend(first, amounts([8000n], ['1600']), '2026-01-01', 1);
  const result = projectDocumentAsOf(history(original, [first, second], '2026-01-01'));
  assert.equal(result.money!.gross_pence, '9600');
  assert.deepEqual(result.included_amendment_ids, [first.event_id, second.event_id]);
});

test('mixed VAT and penny snapshots retain authoritative per-line values with signed deltas', () => {
  // Precalculated 20%, 5%, 0% and penny fixtures; no tax rates enter this helper.
  const original = origin(amounts([10000n, 20000n, 30000n, 3n], ['2000', '1000', '0', '1']));
  const after = amounts([9000n, 21000n, 29999n, 2n], ['1800', '1050', '0', '0']);
  const result = projectDocumentAsOf(history(original, [amend(original, after)]));
  assert.deepEqual(result.money, after);
  assert.deepEqual(result.movements[1]!.delta.lines.map(line => [line.net_pence, line.vat_pence, line.gross_pence]),
    [['-1000', '-200', '-1200'], ['1000', '50', '1050'], ['-1', '0', '-1'], ['-1', '-1', '-2']]);
  assert.equal(result.movements[1]!.delta.gross_pence, '-153');
});

test('maximum native precision and a single-penny amendment never use floating point money', () => {
  const original = origin(amounts([MAX_PENCE - 1n], ['1']));
  const after = amounts([MAX_PENCE - 2n], ['1']);
  const result = projectDocumentAsOf(history(original, [amend(original, after)]));
  assert.equal(result.money!.gross_pence, '999999999998');
  assert.equal(result.movements[1]!.delta.gross_pence, '-1');
  assert.equal(result.movements[1]!.delta.vat_pence, '0');
  const nearZero = amounts([1n], ['0']);
  assert.equal(projectDocumentAsOf(history(origin(nearZero))).money!.gross_pence, '1');
});

test('all document kinds retain positive own amounts; credit projection grants no parent capacity', () => {
  for (const kind of ['sales_invoice', 'purchase_bill', 'sales_credit_note', 'supplier_credit_note'] as const) {
    const original = origin(amounts([1000n], ['200']), kind);
    const result = projectDocumentAsOf(history(original, [amend(original, amounts([500n], ['100']))]));
    assert.equal(result.kind, kind);
    assert.equal(result.money!.gross_pence, '600');
    assert.equal(result.movements[1]!.delta.gross_pence, '-600');
    assert.equal(Object.hasOwn(result, 'credit_capacity'), false);
  }
  const parentBefore = freezeDeep({ gross: '12000', credited: '1200', paid: '5000' });
  const credit = origin(amounts([1000n], ['200']), 'sales_credit_note');
  projectDocumentAsOf(history(credit, [amend(credit, amounts([1500n], ['300']))]));
  assert.equal(settlementAmounts(parentBefore.gross, parentBefore.credited, parentBefore.paid).open_minor, '5800');
  // The future native command must reject an ineligible correction; projection
  // is deliberately not a payment/credit capacity authority.
  assert.throws(() => settlementAmounts('4000', '0', '5000'), /SETTLEMENT_LEDGER_MISMATCH/);
  assert.throws(() => settlementAmounts('1000', '1200', '0'), /SETTLEMENT_LEDGER_MISMATCH/);
});

test('complete frozen history yields deterministic detached deeply frozen results', () => {
  const input = freezeDeep(corrected());
  const before = JSON.stringify(input);
  const a = projectDocumentAsOf(input), b = projectDocumentAsOf(input);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(input), before);
  assert.notEqual(a.money, input.amendments.at(-1)!.after);
  assert.notEqual(a.movements[0]!.delta.lines[0], input.original.money.lines[0]);
  for (const value of [a, a.money, a.money!.lines, a.money!.lines[0], a.movements,
    a.movements[0], a.movements[1]!.delta, a.included_amendment_ids, a.excluded_amendment_ids]) assert.equal(Object.isFrozen(value), true);
});

test('money must be bounded canonical integer strings, not loose coercible values', () => {
  for (const value of [1, 1n, null, undefined, true, '', '-0', '+0', '+1', '01', ' 1', '1 ', '1.0', '1e2',
    'NaN', 'Infinity', '-1', '1000000000000', '9'.repeat(1000)]) {
    const input = history();
    rejects({ ...input, original: { ...input.original, money: { ...input.original.money, net_pence: value } } }, 'MONEY_INVALID');
  }
  for (const value of ['-0', '-1000000000000', '+1', '01', 0]) {
    const input = corrected(), event = input.amendments[0]!;
    rejects({ ...input, amendments: [{ ...event, delta: { ...event.delta, net_pence: value } }, input.amendments[1]] }, 'MONEY_INVALID');
  }
});

test('zero or negative whole documents and inconsistent line/totals money reject', () => {
  rejects(history(origin(amounts([0n], ['0']))), 'MONEY_INVALID');
  const input = history(), value = input.original.money;
  rejects({ ...input, original: { ...input.original, money: { ...value, gross_pence: '11999' } } }, 'MONEY_MISMATCH');
  rejects({ ...input, original: { ...input.original, money: { ...value, net_pence: '9999', gross_pence: '11999' } } }, 'MONEY_MISMATCH');
  rejects({ ...input, original: { ...input.original, money: { ...value, lines: [{ ...value.lines[0], vat_pence: '1999' }] } } }, 'MONEY_MISMATCH');
});

test('source, event and requested company/document scopes must all agree', () => {
  for (const field of ['company_id', 'document_id'] as const) {
    const input = corrected();
    rejects({ ...input, [field]: uuid(99) }, 'SCOPE_MISMATCH');
    rejects({ ...input, original: { ...input.original, [field]: uuid(99) } }, 'SCOPE_MISMATCH');
    rejects({ ...input, amendments: [{ ...input.amendments[0], [field]: uuid(99) }, input.amendments[1]] }, 'SCOPE_MISMATCH');
  }
});

test('identity fields validate UUID shape, while canonical casing cannot bypass identity checks', () => {
  const input = corrected();
  for (const value of ['', 'not-a-uuid', uuid(1).replace('-4000-', '-0000-'), uuid(1).replace('-8000-', '-7000-'), null, 5]) {
    rejects({ ...input, head_revision: value }, 'IDENTITY_INVALID');
    rejects({ ...input, original: { ...input.original, journal_id: value } }, 'IDENTITY_INVALID');
    rejects({ ...input, amendments: [{ ...input.amendments[0], event_id: value }, input.amendments[1]] }, 'IDENTITY_INVALID');
  }
  const upper = JSON.parse(JSON.stringify(input).replace(/a0000000/g, 'A0000000'));
  assert.deepEqual(projectDocumentAsOf(upper), projectDocumentAsOf(input));
});

test('financial context is immutable and requires a canonical SHA-256 identity', () => {
  const input = corrected();
  for (const value of [null, '', 'sha256:ab', `sha256:${'AB'.repeat(32)}`, context.slice(7)]) {
    rejects({ ...input, original: { ...input.original, financial_context_hash: value } }, 'IDENTITY_INVALID');
  }
  rejects({ ...input, amendments: [{ ...input.amendments[0], financial_context_hash: `sha256:${'cd'.repeat(32)}` }, input.amendments[1]] }, 'CONTEXT_MISMATCH');
});

test('invalid calendar dates and posting range reject; a valid leap date works', () => {
  for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', '2026-01-01T00:00:00Z', '0000-01-01', null, 20260101]) {
    rejects({ ...history(), as_of: value }, 'DATE_INVALID');
  }
  for (const value of ['1899-12-31', '2200-01-01', '2026-02-29']) {
    const input = corrected();
    rejects({ ...input, original: { ...input.original, effective_date: value } }, 'DATE_INVALID');
    rejects({ ...input, amendments: [{ ...input.amendments[0], effective_date: value }, input.amendments[1]] }, 'DATE_INVALID');
  }
  assert.equal(projectDocumentAsOf({ ...history(), as_of: '2028-02-29' }).exists, true);
});

test('correction dates cannot precede the original or previous correction', () => {
  const input = corrected();
  rejects({ ...input, amendments: [{ ...input.amendments[0], effective_date: '2025-12-31' }, input.amendments[1]] }, 'DATE_ORDER_INVALID');
  rejects({ ...input, amendments: [input.amendments[0], { ...input.amendments[1], effective_date: '2026-01-31' }] }, 'DATE_ORDER_INVALID');
});

test('duplicate event, replay request, journal or revision identity cannot enter a history', () => {
  const input = corrected(), first = input.amendments[0]!, second = input.amendments[1]!;
  for (const [field, code] of [['event_id', 'DUPLICATE_EVENT'], ['request_id', 'DUPLICATE_REQUEST'],
    ['journal_id', 'DUPLICATE_JOURNAL'], ['revision', 'REVISION_CHAIN_INVALID']] as const) {
    rejects({ ...input, amendments: [first, { ...second, [field]: first[field].toUpperCase() }] }, code);
  }
  rejects({ ...input, amendments: [{ ...first, journal_id: input.original.journal_id }, second] }, 'DUPLICATE_JOURNAL');
  rejects({ ...input, amendments: [{ ...first, revision: input.original.revision }, second] }, 'REVISION_CHAIN_INVALID');
});

test('missing, reordered, stale or truncated history is rejected against its independent head', () => {
  const input = corrected(), first = input.amendments[0]!, second = input.amendments[1]!;
  rejects({ ...input, amendments: [second] }, 'REVISION_CHAIN_INVALID');
  rejects({ ...input, amendments: [second, first] }, 'REVISION_CHAIN_INVALID');
  rejects({ ...input, amendments: [{ ...first, previous_revision: uuid(99) }, second] }, 'REVISION_CHAIN_INVALID');
  rejects({ ...input, amendments: [first] }, 'HEAD_REVISION_MISMATCH');
  rejects({ ...input, amendments: [] }, 'HEAD_REVISION_MISMATCH');
  rejects({ ...input, head_revision: input.original.revision }, 'HEAD_REVISION_MISMATCH');
});

test('every before snapshot must exactly equal the preceding revision, including line amounts', () => {
  const input = corrected(), first = input.amendments[0]!, second = input.amendments[1]!;
  const stale = amend(input.original, second.after, second.effective_date, 2);
  rejects({ ...input, amendments: [first, { ...stale, previous_revision: first.revision }] }, 'BEFORE_SNAPSHOT_MISMATCH');
  const original = origin(amounts([100n, 100n], ['20', '20']));
  const event = amend(original, amounts([90n, 100n], ['18', '20']));
  const redistributed = amounts([110n, 90n], ['22', '18']);
  rejects(history(original, [{ ...event, before: redistributed, delta: difference(redistributed, event.after) }]), 'BEFORE_SNAPSHOT_MISMATCH');
});

test('declared differences must match every aggregate and line, not just balance in total', () => {
  const input = corrected(), first = input.amendments[0]!;
  const wrong = { ...first.delta, net_pence: '-900', gross_pence: '-1100',
    lines: [{ original_line_ref: 0, net_pence: '-900', vat_pence: '-200', gross_pence: '-1100' }] };
  rejects({ ...input, amendments: [{ ...first, delta: wrong }, input.amendments[1]] }, 'DELTA_MISMATCH');
  const original = origin(amounts([100n, 100n], ['20', '20']));
  const event = amend(original, amounts([90n, 80n], ['18', '16']));
  rejects(history(original, [{ ...event, delta: { ...event.delta, lines: [
    { original_line_ref: 0, net_pence: '-20', vat_pence: '-4', gross_pence: '-24' },
    { original_line_ref: 1, net_pence: '-10', vat_pence: '-2', gross_pence: '-12' },
  ] } }]), 'DELTA_MISMATCH');
});

test('all snapshots retain original line references, ordering and count', () => {
  const original = origin(amounts([100n, 100n], ['20', '20'], [2, 4]));
  const event = amend(original, amounts([90n, 100n], ['18', '20'], [2, 4]));
  for (const field of ['before', 'after', 'delta'] as const) {
    const snapshot = event[field];
    rejects(history(original, [{ ...event, [field]: { ...snapshot, lines: [...snapshot.lines].reverse() } }]), 'LINE_IDENTITY_INVALID');
    rejects(history(original, [{ ...event, [field]: { ...snapshot, lines: snapshot.lines.map((line, i) => ({ ...line, original_line_ref: i })) } }]), 'LINE_IDENTITY_INVALID');
  }
  const merged = amounts([190n], ['38'], [2]);
  rejects(history(original, [{ ...event, after: merged }]), 'LINE_IDENTITY_INVALID');
});

test('invalid, repeated or missing line references and sparse arrays reject', () => {
  const original = origin(amounts([100n, 100n], ['20', '20']));
  for (const value of [-1, 200, 1.5, '0', null, NaN]) {
    rejects(history({ ...original, money: { ...original.money, lines: [{ ...original.money.lines[0]!, original_line_ref: value }, original.money.lines[1]] } } as PostedDocumentOrigin), 'LINE_IDENTITY_INVALID');
  }
  rejects(history({ ...original, money: { ...original.money, lines: original.money.lines.map(line => ({ ...line, original_line_ref: 0 })) } }), 'LINE_IDENTITY_INVALID');
  const sparse: unknown[] = new Array(2); sparse[1] = original.money.lines[1];
  rejects(history({ ...original, money: { ...original.money, lines: sparse } } as PostedDocumentOrigin), 'SHAPE_INVALID');
});

test('corrupt future amendments still reject before original existence or financial cutoff', () => {
  const input = corrected(), second = input.amendments[1]!;
  for (const as_of of ['2025-01-01', '2026-01-31', '2026-02-01']) {
    rejects({ ...input, as_of, amendments: [input.amendments[0], { ...second, previous_revision: uuid(99) }] }, 'REVISION_CHAIN_INVALID');
    rejects({ ...input, as_of, amendments: [input.amendments[0]] }, 'HEAD_REVISION_MISMATCH');
  }
});

test('unchanged money and real line redistribution with zero aggregate have distinct blockers', () => {
  const original = origin(amounts([100n, 100n], ['20', '20']));
  rejects(history(original, [amend(original, original.money)]), 'NO_FINANCIAL_CHANGE');
  const redistributed = amounts([110n, 90n], ['22', '18']);
  rejects(history(original, [amend(original, redistributed)]), 'ZERO_AGGREGATE_CHANGE_UNSUPPORTED');
});

test('only explicit posted financial schemas are accepted; metadata is not a financial event', () => {
  const input = corrected(), first = input.amendments[0]!;
  for (const value of [null, [], 5, {}, new Date()]) rejects(value, 'SHAPE_INVALID');
  rejects({ ...input, actor_id: 'untrusted actor' }, 'SHAPE_INVALID');
  for (const changed of [{ kind: 'invoice' }, { currency: 'USD' }, { status: 'draft' }, { notes: 'metadata' }]) {
    rejects({ ...input, original: { ...input.original, ...changed } }, 'SHAPE_INVALID');
  }
  for (const changed of [{ kind: 'metadata' }, { status: 'draft' }, { reason: 'not part of this projection' }]) {
    rejects({ ...input, amendments: [{ ...first, ...changed }, input.amendments[1]] }, 'SHAPE_INVALID');
  }
  const { journal_id: _journal, ...withoutJournal } = first;
  rejects({ ...input, amendments: [withoutJournal, input.amendments[1]] }, 'SHAPE_INVALID');
  rejects({ ...input, amendments: [{ ...first, journal_id: null }, input.amendments[1]] }, 'IDENTITY_INVALID');
  rejects({ ...input, amendments: new Array(10001) }, 'SHAPE_INVALID');
});

test('snapshot line bounds match the native 200-line contract', () => {
  assert.equal(projectDocumentAsOf(history(origin(amounts(Array(200).fill(1n), Array(200).fill('0'))))).money!.lines.length, 200);
  const input = history();
  for (const lines of [[], new Array(201), null]) {
    rejects({ ...input, original: { ...input.original, money: { ...input.original.money, lines } } }, 'SHAPE_INVALID');
  }
});
