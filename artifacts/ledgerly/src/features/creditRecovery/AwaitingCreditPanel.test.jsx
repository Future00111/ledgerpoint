import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreditLineControl, CreditSelectionAction, CreditSelectionForm } from './AwaitingCreditPanel';

const noop = () => {};
const control = { index: 1, description: 'Surcharge', ready: true, loading: false, error: null,
  canManage: true, checked: false, busy: false, onSelect: noop, panelId: 'awaiting-credits-bill' };
const doc = { source: { line_items: [{ description: 'Caliper', quantity: '2' }, { description: 'Surcharge', quantity: '2' }] },
  money: { lines: [{ gross_pence: '12000' }, { gross_pence: '4000' }] } };
const lines = doc.source.line_items.map((line, index) => ({ original_line_ref: index, selected: index === 1,
  quantity: index === 1 ? '0.5' : line.quantity, part_reference: '', job_reference: 'SYNTHETIC' }));
const values = { reason: 'Returned', return_reference: 'RETURN-123', returned_on: '2026-10-29', expected_by: '2026-11-05' };
const form = { doc, lines, values, lineClaims: new Map(), busy: false, loading: false,
  onSave: noop, onLineChange: noop, onValueChange: noop, onClose: noop, panelId: 'awaiting-credits-bill' };
const render = element => renderToStaticMarkup(element);

test('original bill line control is an accessible checkbox and passes its exact source index', () => {
  const selected = [];
  const element = CreditLineControl({ ...control, onSelect: (...args) => selected.push(args) });
  const checkbox = React.Children.toArray(element.props.children).find(child => child.type === 'input');
  assert.equal(checkbox.props.type, 'checkbox');
  assert.equal(checkbox.props['aria-label'], 'Select line 2 awaiting credit: Surcharge');
  assert.equal(checkbox.props['aria-haspopup'], 'dialog');
  checkbox.props.onChange({ target: { checked: true } });
  assert.deepEqual(selected, [[1, true]]);
  assert.ok(render(<CreditLineControl {...control} checked />).includes('checked=""'));
});

test('tracked source line renders its current status linked to history, with no duplicate selector', () => {
  for (const canManage of [true, false]) {
    const html = render(<CreditLineControl {...control} canManage={canManage} claim={{ status: 'partial', cancelled: false }} />);
    assert.ok(html.includes('Partially received'));
    assert.ok(html.includes('href="#awaiting-credits-bill"'));
    assert.ok(!html.includes('type="checkbox"'));
  }
});

test('untracked read-only lines and header expose no selection controls', () => {
  const html = render(<CreditLineControl {...control} canManage={false} />);
  assert.ok(html.includes('Not tracked'));
  assert.ok(!html.includes('input'));
  assert.equal(render(<CreditSelectionAction {...control} canManage={false} onOpen={noop} />), '');
});

test('initial loading, failed lookup and unverified access never expose write controls', () => {
  for (const state of [{ loading: true, ready: false }, { error: new Error('Unavailable') }, { ready: false }]) {
    const line = render(<CreditLineControl {...control} {...state} />);
    const action = render(<CreditSelectionAction {...control} {...state} onOpen={noop} />);
    assert.ok(!line.includes('type="checkbox"'));
    assert.ok(!action.includes('<button'));
    assert.ok((line + action).includes(state.loading ? 'Checking credit' : 'credit tracking') || line.includes('Credit status unavailable'));
  }
});

test('header action opens selection and remains usable when all lines already have claims', () => {
  let opened = 0;
  const action = CreditSelectionAction({ ...control, onOpen: () => { opened++; } });
  action.props.onClick();
  assert.equal(opened, 1);
  assert.equal(action.props.disabled, false);
  assert.ok(render(action).includes('Select lines awaiting credit'));
  const lineClaims = new Map([[0, { status: 'received' }], [1, { status: 'awaiting' }]]);
  const html = render(<CreditSelectionForm {...form} lineClaims={lineClaims} />);
  assert.ok(html.includes('All items from this bill are already tracked'));
  assert.ok(html.includes('View credit tracking history'));
  assert.ok(html.includes('href="#awaiting-credits-bill"'));
  assert.ok(!html.includes('<form'));
  assert.ok(!html.includes('type="checkbox"'));
});

test('dialog form keeps source line selection and partial quantity, with normal date inputs', () => {
  const html = render(<CreditSelectionForm {...form} />);
  assert.ok(html.includes('id="claim-quantity-1"'));
  assert.ok(!html.includes('id="claim-quantity-0"'));
  assert.ok(html.includes('value="0.5"'));
  assert.ok(html.includes('Track 1 item'));
  assert.equal((html.match(/type="date"/g) ?? []).length, 2);
  assert.ok(html.includes('value="2026-10-29"'));
  assert.ok(html.includes('value="2026-11-05"'));
  const tracked = render(<CreditSelectionForm {...form} lineClaims={new Map([[1, { status: 'awaiting' }]])} />);
  assert.ok(tracked.includes('This line is already tracked'));
  assert.ok(!tracked.includes('id="claim-quantity-1"'));
  assert.ok(tracked.includes('Track 0 items'));
});

test('saving disables selection, submission and explicit close controls', () => {
  const html = render(<CreditSelectionForm {...form} busy />);
  assert.ok(html.includes('<fieldset disabled=""'));
  assert.ok(html.includes('Saving…'));
  const element = CreditSelectionAction({ ...control, busy: true, onOpen: noop });
  assert.equal(element.props.disabled, true);
});
