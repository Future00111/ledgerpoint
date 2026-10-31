import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import PaidCreditReview from './PaidCreditReview';
test('credit review distinguishes full credit, offset, released cash allocation and original pool evidence',()=>{
 const html=renderToStaticMarkup(<PaidCreditReview review={{original_id:'BILL1',original_kind:'purchase_bill',original_number:'B-1',credit_minor:'3000',offset_minor:'2000',released_minor:'1000',remaining_minor:'0',releases:[{id:'child',payment_id:'PAY1',pool_account_id:'POOL1',payment_reference:'Bank payment',payment_journal_id:'JOURNAL1',before_unapplied_minor:'500',after_unapplied_minor:'1500',amount_minor:'1000'}]}}/>);
 for(const text of ['£30.00','£20.00','£10.00','£0.00','PAY1','POOL1','does not send a refund','Original cash payments remain unchanged','£5.00','£15.00','href="/bills/BILL1"','href="/accounting/journals/JOURNAL1"'])assert.ok(html.includes(text),text);
});
