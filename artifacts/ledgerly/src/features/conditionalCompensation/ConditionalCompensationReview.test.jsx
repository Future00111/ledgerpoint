import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compensationInput, ConditionalCompensationReview, CompensationRecovery } from './ConditionalCompensationReview';
import { createAccountingClient } from '../../api/accountingDocuments.mjs';

test('compensation review displays full frozen discount, allocation change and cash/no-redemption consequences with posting disabled', () => {
  const html=renderToStaticMarkup(<ConditionalCompensationReview review={{
    original_number:'INV-120',credit_number:'CREDIT-12',credit_money:{net_pence:'1000',vat_pence:'200',gross_pence:'1200'},
    unallocated_minor:'1000',after_allocated_minor:'9800',after_open_minor:'2200',
    intent:{date:'2026-11-05',reason:'Allocation reduced'}
  }} />);
  for (const text of ['£12.00','£10.00','£2.00','£98.00','£22.00','Cash does not change','cannot be redeemed again','Posting is unavailable','disabled'])
    assert.ok(html.includes(text),text);
});
test('recovery distinguishes unknown from committed and cannot silently authorise retry', () => {
  const unknown=renderToStaticMarkup(<CompensationRecovery outcome={{state:'unknown'}} />);
  assert.match(unknown,/do not submit another request/);assert.doesNotMatch(unknown,/href=/);
  const known=renderToStaticMarkup(<CompensationRecovery outcome={{state:'known',reversal_journal_id:'reversal',unallocation_journal_id:'allocation'}} />);
  assert.match(known,/accounting\/journals\/reversal/);assert.match(known,/accounting\/journals\/allocation/);
});
test('surplus-refund review shows unchanged refund and newly available pool without authorising posting',()=>{
 const html=renderToStaticMarkup(<ConditionalCompensationReview review={{
  original_number:'INV-120',credit_number:'CREDIT-12',credit_money:{net_pence:'1000',vat_pence:'200',gross_pence:'1200'},
  unallocated_minor:'1000',after_allocated_minor:'9800',after_open_minor:'2200',after_unapplied_minor:'2100',
  refunded_minor:'100',preserved_refunds:[{id:'refund'}],intent:{date:'2026-11-05',reason:'Review'}
 }} />);
 for(const text of ['£21.00','£1.00','Already refunded','does not reclaim refunded money','disabled'])
  assert.ok(html.includes(text),text);
});
test('input retains exact selected identities and pennies without binary float rounding', () => {
  const item={original_id:'original',credit_id:'credit',payment_ids:['payment']};
  assert.deepEqual(compensationInput(item,'payment','10.01','2026-11-05',' Genuine reason ','request'),{
    request_id:'request',original_id:'original',credit_id:'credit',payment_id:'payment',amount_minor:'1001',date:'2026-11-05',reason:'Genuine reason'});
  for (const n of ['0','-1','1.001','1e2','']) assert.throws(()=>compensationInput(item,'payment',n,'2026-11-05','Reason','r'));
  assert.throws(()=>compensationInput(item,'foreign','10','2026-11-05','Reason','r'));
});
test('native client sends review/recovery to company-scoped endpoints and exposes no compensation commit',async()=>{
  const calls=[];
  const client=createAccountingClient(async(url,options)=>{calls.push({url,...options});return {ok:true,json:async()=>({data:{posting_available:false}})};});
  await client.compensationContext('company');
  await client.reviewCompensation('company',{request_id:'request'});
  await client.recoverCompensation('company','request');
  assert.deepEqual(calls.map(c=>c.url),[
    '/api/companies/company/accounting-conditional-compensations/context',
    '/api/companies/company/accounting-conditional-compensations/review',
    '/api/companies/company/accounting-conditional-compensations/operations/request']);
  assert.deepEqual(calls.map(c=>c.method),['GET','POST','GET']);
  assert.equal(client.commitCompensation,undefined);assert.ok(calls.every(c=>c.credentials==='include'));
});
test('full payment reversal review clearly changes cash, preserves disabled confirmation and provides recovery journal',()=>{
 const input=compensationInput({original_id:'o',credit_id:'c',payment_ids:['p']},'p','108','2026-11-05','Reverse','r','reverse_payment');
 assert.equal(input.payment_action,'reverse_payment');assert.equal(input.amount_minor,'10800');
 const html=renderToStaticMarkup(<ConditionalCompensationReview review={{
  original_number:'INV',credit_number:'CR',credit_money:{net_pence:'1000',vat_pence:'200',gross_pence:'1200'},
  unallocated_minor:'10800',after_allocated_minor:'0',after_open_minor:'12000',payment_action:'reverse_payment',
  cash_reversal:{amount_minor:'10800'},cash_change_minor:'-10800',intent:input
 }} />);
 assert.match(html,/changes the recorded bank balance/);assert.match(html,/All three adjustments/);
 assert.doesNotMatch(html,/Cash does not change/);assert.match(html,/disabled/);
 const recovered=renderToStaticMarkup(<CompensationRecovery outcome={{state:'known',reversal_journal_id:'a',unallocation_journal_id:'b',cash_reversal_journal_id:'c'}}/>);
 assert.match(recovered,/accounting\/journals\/c/);
});
