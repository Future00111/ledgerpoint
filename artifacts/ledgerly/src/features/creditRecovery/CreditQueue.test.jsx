import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreditQueueFilters, CreditRecoverySummary } from './AwaitingCreditsPage';

function elements(root) {
  const found = [];
  const visit = node => { if (!React.isValidElement(node)) return; found.push(node); React.Children.forEach(node.props.children, visit); };
  visit(root); return found;
}

test('queue filters select their own stable status and expose pressed state', () => {
  let selected;
  const element = CreditQueueFilters({ filter: 'matches', counts: { matches: 2, overdue: 3 }, onChange: value => { selected = value; } });
  const buttons = elements(element).filter(node => node.type === 'button');
  const active = buttons.filter(node => node.props['aria-pressed']);
  assert.equal(active.length, 1);
  active[0].props.onClick(); assert.equal(selected, 'matches');
  buttons[2].props.onClick(); assert.equal(selected, 'overdue');
  const html = renderToStaticMarkup(element);
  assert.ok(html.includes('aria-label="Credit tracking status"'));
  assert.ok(!html.includes('role="tab"'));
});

test('summary actions jump to filtered queues only when source evidence is available', () => {
  const summary = { remaining: '25000', waiting: 4, matches: 1, overdue: 2 };
  let selected;
  const ready = CreditRecoverySummary({ summary, ready: true, onChange: value => { selected = value; } });
  const buttons = elements(ready).filter(node => node.type === 'button');
  buttons[1].props.onClick(); assert.equal(selected, 'matches');
  assert.ok(renderToStaticMarkup(ready).includes('£250.00'));
  const unavailable = CreditRecoverySummary({ summary, ready: false, onChange: () => {} });
  assert.ok(elements(unavailable).filter(node => node.type === 'button').every(node => node.props.disabled));
  const html = renderToStaticMarkup(unavailable);
  assert.ok(!html.includes('£250.00'));
  assert.ok(!html.includes('£0.00'));
});
