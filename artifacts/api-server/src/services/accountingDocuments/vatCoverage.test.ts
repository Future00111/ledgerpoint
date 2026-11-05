import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVatCoverage, VAT_COVERAGE_CASES, type VatSourceMovement, type VatAmounts } from './vatCoverage';
import { calculateTaxLine } from '../financialDrafts/productionAuthority';

const vat = (): VatAmounts => ({ applicable: true, box1_pence: '1500', box4_pence: '600',
  box5_pence: '900', box6_pence: '7500', box7_pence: '4000', net_payable_pence: '900', repayment: false });
const movement = (id: string, kind: VatSourceMovement['kind'], net: string, tax: string,
  date = '2026-10-15', extra: Partial<VatSourceMovement> = {}): VatSourceMovement => ({
  id, journal_id: `journal-${id}`, kind, date, net_minor: net, vat_minor: tax,
  vat_box: kind.startsWith('sales') ? '1' : '4', movement_kind: 'original', ...extra,
});
const fixture = () => ({ from: '2026-10-01', to: '2026-10-31', vat: vat(), movements: [
  movement('invoice', 'sales_invoice', '10000', '2000'),
  movement('credit', 'sales_credit_note', '-2500', '-500'),
  movement('bill', 'purchase_bill', '4000', '800'),
  movement('supplier-credit', 'supplier_credit_note', '-1000', '-200'),
  movement('nonrecoverable', 'purchase_bill', '1000', '0'),
  movement('old', 'sales_invoice', '99900', '88800', '2026-09-30'),
] });

test('all five supported boxes reconcile signed canonical evidence; unsupported boxes stay unknown', () => {
  const result = buildVatCoverage(fixture());
  assert.equal(result.status, 'workings_reconciled');
  assert.equal(result.filing_ready, false);
  assert.equal(result.movement_count, 5); assert.equal(result.source_document_count, 5); assert.equal(result.journal_count, 5);
  assert.deepEqual(result.boxes.filter(box => box.status === 'reconciled').map(box => [box.box, box.amount_pence, box.source_total_pence]),
    [['1', '1500', '1500'], ['4', '600', '600'], ['5', '900', '900'], ['6', '7500', '7500'], ['7', '4000', '4000']]);
  assert.deepEqual(result.boxes.filter(box => box.status === 'unsupported').map(box => [box.box, box.amount_pence, box.source_total_pence]),
    [['2', null, null], ['3', null, null], ['8', null, null], ['9', null, null]]);
  assert.deepEqual(result.blockers.map(item => item.code), ['INCOMPLETE_RETURN', 'SUPPORTED_CASE_REVIEW', 'FILING_UNAVAILABLE']);
});

test('VAT and net amounts, zero/repayment direction and every supported box fail closed on disagreement', () => {
  for (const key of ['box1_pence', 'box4_pence', 'box5_pence', 'box6_pence', 'box7_pence', 'net_payable_pence'] as const) {
    const input = fixture(); input.vat[key] = (BigInt(input.vat[key]) + 1n).toString();
    assert.throws(() => buildVatCoverage(input), /VAT_COVERAGE_MISMATCH/, key);
  }
  const wrongDirection = fixture(); wrongDirection.vat.repayment = true;
  assert.throws(() => buildVatCoverage(wrongDirection), /VAT_COVERAGE_MISMATCH/);
  const empty = { ...fixture(), movements: [], vat: { applicable: true, box1_pence: '0', box4_pence: '0', box5_pence: '0',
    box6_pence: '0', box7_pence: '0', net_payable_pence: '0', repayment: false } };
  assert.equal(buildVatCoverage(empty).status, 'workings_reconciled');
  assert.equal(buildVatCoverage(empty).filing_ready, false);
  empty.vat.repayment = true;
  assert.throws(() => buildVatCoverage(empty), /VAT_COVERAGE_MISMATCH/);
});

test('nonrecoverable supplier VAT is not inferred from gross minus net', () => {
  const input = fixture();
  // Supplier actually charged £2 VAT; the authoritative report includes £0 in box4.
  Object.assign(input.movements[4]!, { gross_minor: '1200' });
  assert.equal(buildVatCoverage(input).boxes.find(box => box.box === '4')!.amount_pence, '600');
  input.movements[4]!.vat_minor = '200';
  assert.throws(() => buildVatCoverage(input), /VAT_COVERAGE_MISMATCH/);
});

test('dated corrections are differences and never rewrite historical VAT movements', () => {
  const original = movement('invoice', 'sales_invoice', '10000', '2000', '2026-09-20');
  const correction = movement('invoice', 'sales_invoice', '-1000', '-200', '2026-10-15',
    { journal_id: 'correction-journal', movement_kind: 'financial_correction' });
  const input = { from: '2026-10-01', to: '2026-10-31', movements: [original, correction], vat: {
    applicable: true, box1_pence: '-200', box4_pence: '0', box5_pence: '200', box6_pence: '-1000', box7_pence: '0',
    net_payable_pence: '-200', repayment: true,
  } };
  const October = buildVatCoverage(input);
  assert.equal(October.movement_count, 1); assert.equal(October.source_document_count, 1);
  assert.equal(October.boxes.find(box => box.box === '1')!.amount_pence, '-200');
  const September = buildVatCoverage({ ...input, from: '2026-09-01', to: '2026-09-30', vat: { ...input.vat,
    box1_pence: '2000', box5_pence: '2000', box6_pence: '10000', net_payable_pence: '2000', repayment: false } });
  assert.equal(September.boxes.find(box => box.box === '1')!.amount_pence, '2000');
  const cumulative = buildVatCoverage({ ...input, from: '2026-09-01', vat: { ...input.vat,
    box1_pence: '1800', box5_pence: '1800', box6_pence: '9000', net_payable_pence: '1800', repayment: false } });
  assert.equal(cumulative.movement_count, 2); assert.equal(cumulative.source_document_count, 1);
  assert.equal(cumulative.journal_count, 2);
  input.movements[1] = { ...correction, net_minor: '9000', vat_minor: '1800' };
  assert.throws(() => buildVatCoverage(input), /VAT_COVERAGE_MISMATCH/, 'replacement totals cannot masquerade as a delta');
});

test('mixed 20/5/0 line fixtures from the existing calculator reconcile in both price bases', () => {
  for (const basis of ['excluding_vat', 'including_vat']) {
    const lines = [2000n, 500n, 0n].map(rate => calculateTaxLine(10000n, rate, basis, '100'));
    const net = lines.reduce((sum, line) => sum + line.net, 0n).toString();
    const tax = lines.reduce((sum, line) => sum + line.vat, 0n).toString();
    assert.deepEqual([net, tax], basis === 'including_vat' ? ['27857', '2143'] : ['30000', '2500']);
    const input = { ...fixture(), movements: [movement('mixed', 'sales_invoice', net, tax)], vat: {
      applicable: true, box1_pence: tax, box4_pence: '0', box5_pence: tax, box6_pence: net,
      box7_pence: '0', net_payable_pence: tax, repayment: false,
    } };
    assert.equal(buildVatCoverage(input).boxes.find(box => box.box === '6')!.amount_pence, net);
  }
});

test('penny and aggregate values above Number safe integer retain exact reconciliation', () => {
  for (const [net, tax] of [['3', '1'], ['900719925474099312345', '180143985094819862469']]) {
    const input = { ...fixture(), movements: [movement('precise', 'sales_invoice', net!, tax!)], vat: {
      applicable: true, box1_pence: tax!, box4_pence: '0', box5_pence: tax!, box6_pence: net!, box7_pence: '0',
      net_payable_pence: tax!, repayment: false,
    } };
    assert.equal(buildVatCoverage(input).boxes.find(box => box.box === '1')!.amount_pence, tax);
    input.vat.box1_pence = (BigInt(tax!) + 1n).toString();
    assert.throws(() => buildVatCoverage(input), /VAT_COVERAGE_MISMATCH/);
  }
});

test('duplicate journals, malformed money, wrong signs, wrong boxes and impossible dates reject', () => {
  const edits: ((input: ReturnType<typeof fixture>) => void)[] = [
    input => { input.movements.push({ ...input.movements[0]! }); },
    input => { input.movements[1]!.vat_minor = '500'; },
    input => { input.movements[0]!.net_minor = '-10000'; },
    input => { input.movements[0]!.vat_box = '4'; },
    input => { input.movements[0]!.date = '2026-02-30'; },
    input => { input.movements[0]!.vat_minor = '-0'; },
    input => { input.movements[0]!.vat_minor = '01'; },
    input => { input.movements[0]!.vat_minor = '1e3'; },
    input => { (input.movements[0] as any).vat_minor = 2000; },
    input => { input.from = '2026-11-01'; },
  ];
  for (const edit of edits) { const input = fixture(); edit(input); assert.throws(() => buildVatCoverage(input), /VAT_COVERAGE_MISMATCH/); }
});

test('non-VAT businesses are not applicable, never a reconciled or filing-ready return', () => {
  const input = fixture(); input.vat.applicable = false;
  const result = buildVatCoverage(input);
  assert.equal(result.status, 'not_applicable'); assert.equal(result.filing_ready, false);
  assert.equal(result.scope.scheme, null); assert.equal(result.scope.accounting_basis, null);
  assert.deepEqual(result.boxes, []); assert.equal(result.movement_count, 0);
  assert.deepEqual(result.cases, []); assert.deepEqual(result.blockers, []);
});

test('coverage states are detached and immutable; engine cases do not claim actual period eligibility', () => {
  const input = fixture(), result = buildVatCoverage(input);
  input.vat.box1_pence = '1'; input.movements.length = 0;
  assert.equal(result.boxes[0]!.amount_pence, '1500');
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.boxes)); assert.ok(Object.isFrozen(result.boxes[0]));
  assert.ok(Object.isFrozen(result.scope)); assert.ok(Object.isFrozen(result.cases[0]));
  assert.equal(VAT_COVERAGE_CASES.find(item => item.id === 'other_schemes')!.status, 'unsupported');
  assert.ok(result.blockers.some(item => item.code === 'SUPPORTED_CASE_REVIEW'));
});
