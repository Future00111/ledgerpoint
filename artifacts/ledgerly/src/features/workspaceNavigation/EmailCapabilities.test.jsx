import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {EmailCaptureAvailability} from '@/pages/EmailCapture';
import {EmailConnectionUnavailable, EmailAccountConnectionStatus} from '@/components/email_capture/EmailAccountManager';
import {EmailRuleAvailability} from '@/components/email_capture/EmailRuleManager';
import {workspaceAvailabilityNotice} from './model.mjs';
const render = node => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
test('email unavailable notice provides a working document-inbox alternative', () => {
  const html=render(<EmailCaptureAvailability />);
  assert.match(html,/role="status"/);
  assert.match(html,/connection and scanning are not available/);
  assert.match(html,/do not connect a mailbox or run scans/);
  assert.match(html,/href="\/documents"/);
});
test('email account screen cannot create a simulated connected account', () => {
  const html=render(<EmailConnectionUnavailable />);
  assert.match(html,/Mailbox authorization is not implemented/);
  assert.match(html,/<button[^>]*disabled=""[^>]*>Connect email/);
  assert.equal(html.includes('email@example.com'),false);
  assert.equal(html.includes('simulate a connected account'),false);
  assert.match(render(<EmailAccountConnectionStatus />),/Connection unavailable/);
});
test('saved rule notice distinguishes preferences from automation', () => {
  const html=render(<EmailRuleAvailability />);
  assert.match(html,/Rules are saved preferences/);
  assert.match(html,/does not process emails/);
});
test('saved workflow route explains that active metadata does not execute tasks', () => {
  const notice = workspaceAvailabilityNotice('/automation');
  assert.equal(notice.title, 'Saved workflows do not run automatically');
  assert.match(notice.message, /does not schedule or execute it, send reminders, or change accounting records/);
  assert.match(notice.message, /AI can help draft a plan/);
  assert.equal(notice.path, '/');
  assert.deepEqual(workspaceAvailabilityNotice('/automation/'), notice);
  for (const path of ['/transactions', '/documents', '/automation-history']) {
    assert.equal(workspaceAvailabilityNotice(path), null);
  }
});
