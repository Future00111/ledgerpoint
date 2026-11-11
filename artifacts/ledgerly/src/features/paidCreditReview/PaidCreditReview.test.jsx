import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import PaidCreditReview from './PaidCreditReview';
import {DraftWriteActions} from '../documentDiscounts/DiscountControls';
test('credit review distinguishes full credit, offset, released cash allocation and original pool evidence',()=>{
 const html=renderToStaticMarkup(<PaidCreditReview review={{original_id:'BILL1',original_kind:'purchase_bill',original_number:'B-1',credit_minor:'3000',offset_minor:'2000',released_minor:'1000',remaining_minor:'0',releases:[{id:'child',payment_id:'PAY1',pool_account_id:'POOL1',payment_reference:'Bank payment',payment_journal_id:'JOURNAL1',before_unapplied_minor:'500',after_unapplied_minor:'1500',amount_minor:'1000'}]}}/>);
 for(const text of ['£30.00','£20.00','£10.00','£0.00','PAY1','POOL1','does not send a refund','Original cash payments remain unchanged','£5.00','£15.00','href="/bills/BILL1"','href="/accounting/journals/JOURNAL1"'])assert.ok(html.includes(text),text);
});
test('conditional review renders server eligibility and potential release without promising posting',()=>{
 const html=renderToStaticMarkup(<PaidCreditReview conditional review={{readonly:true,posting_available:false,original_id:'INV1',original_kind:'sales_invoice',original_number:'I-1',credit_minor:'1200',offset_minor:'0',released_minor:'1200',remaining_minor:'0',conditional_admission:{threshold_minor:'10800',qualifying_minor:'10801',deadline:'2199-11-30'},releases:[{id:'release',payment_id:'PAY1',payment_reference:'Receipt',payment_journal_id:'J1',pool_account_id:'POOL',amount_minor:'1200',before_unapplied_minor:'0',after_unapplied_minor:'1200'}]}}/>);
 for(const text of ['Conditional credit eligibility preview','Payment threshold','£108.00','Qualifying payments','£108.01','2199-11-30','Potential payment balance release','would be released from payment','Posting is unavailable','No credit has been posted','href="/invoices/INV1"','£12.00'])assert.ok(html.includes(text),text);
 for(const text of ['This posts the credit','Confirm posting','<button'])assert.ok(!html.includes(text),text);
});

test('conditional draft action offers eligibility while ordinary action retains posting label',()=>{
 const props={capabilities:{edit_drafts:true,post_documents:true},doc:{money:{gross_pence:'1200'}},editId:'credit',onReview:()=>{}};
 const conditional=renderToStaticMarkup(<DraftWriteActions {...props} reviewLabel="Check conditional eligibility"/>);
 assert.ok(conditional.includes('Check conditional eligibility'));assert.ok(!conditional.includes('Review &amp; post'));
 assert.ok(renderToStaticMarkup(<DraftWriteActions {...props}/>).includes('Review &amp; post'));
});

test('current conditional review describes unpaid-only posting and recovery notice blocks unknown resubmission',()=>{
 const html=renderToStaticMarkup(<PaidCreditReview conditional current review={{posting_available:true,original_id:'I1',original_kind:'sales_invoice',credit_minor:'1200',offset_minor:'1200',released_minor:'0',remaining_minor:'0',conditional_admission:{threshold_minor:'10800',qualifying_minor:'10800',deadline:'2199-11-30'},releases:[]}}/>);
 for(const text of ['Conditional discount posting review','Confirm to post','No paid cash is released','Eligibility is checked again'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('Posting is unavailable'));
});
