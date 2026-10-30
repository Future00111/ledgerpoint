import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CorrectionWorkspace } from './DocumentCorrections';
const money={net_pence:'10000',vat_pence:'2000',gross_pence:'12000'};
const source={invoice_number:'INV-1',issue_date:'2026-10-01',price_basis:'excluding_vat',line_items:[{description:'Repair labour',quantity:'1',unit_price:'100.00',tax_code:'STD20'}]};
const context={document:{source},original:{source,money,journal_id:'original'},capabilities:{review_corrections:true,correct_documents:true},blockers:[],history:{amendments:[]}};
const form={reason:'Agreed price',effective_date:'2026-10-30',line_items:[{quantity:'1',unit_price:'90.00'}]};
const review={intent:{effective_date:'2026-10-30'},before:{money},after:{money:{net_pence:'9000',vat_pence:'1800',gross_pence:'10800'}},settlement:{paid_minor:'5000',before_open_minor:'7000',after_open_minor:'5800'}};
const render=(state,ack=false)=>renderToStaticMarkup(<MemoryRouter><CorrectionWorkspace state={state} form={form} acknowledged={ack} /></MemoryRouter>);
test('review displays exact before/after balance, unchanged payments and bounded credit restrictions',()=>{
 const html=render({status:'reviewed',context,review});
 for(const text of ['£120.00','£108.00','£70.00','£58.00','£50.00','cannot receive new credit notes','Immutable original','Post correction'])assert.ok(html.includes(text),text);
 assert.match(html,/disabled=""[^>]*>Post correction/);assert.ok(!render({status:'reviewed',context,review},true).match(/disabled=""[^>]*>Post correction/));
});
test('blocked/read-only context exposes history and explanation without editing or posting controls',()=>{
 const html=render({status:'ready',context:{...context,capabilities:{review_corrections:false,correct_documents:false},blockers:[{code:'CHILD_CREDIT',message:'A linked credit must be resolved first.'}]}});
 assert.ok(html.includes('A linked credit must be resolved first.'));assert.ok(html.includes('Correction history'));assert.ok(!html.includes('Review revised amounts'));assert.ok(!html.includes('Post correction'));
});
test('unknown outcome offers exact-request check and does not offer a fresh post',()=>{
 const html=render({status:'unknown',context,review,error:Error('Interrupted')});
 assert.ok(html.includes('may already be posted'));assert.ok(html.includes('Check this correction again'));assert.ok(html.includes('Leaving or reloading clears'));assert.ok(!html.includes('>Post correction<'));assert.match(html,/disabled=""[^>]*>Close/);
});
test('loading exposes no stale financial values or edit form',()=>{
 const html=render({status:'loading'});assert.ok(!html.includes('£120.00'));assert.ok(!html.includes('Repair labour'));assert.ok(html.includes('aria-busy="true"'));
});
