import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaymentLocator} from './locator.mjs';
const id='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
const browser=()=>{const m=new Map();const b={location:{href:'https://synthetic.invalid/payments?filter=all'},localStorage:{get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};b.history={state:{preserved:true},replaceState:(_,__,url)=>{b.location.href=String(url);}};return b;};
test('opaque locator survives reconstruction/company switch without storing financial data',()=>{
 const b=browser(), a=createPaymentLocator('a',b);a.remember(id);
 assert.equal(createPaymentLocator('a',b).read(),id);assert.equal(createPaymentLocator('b',b).read(),null);
 createPaymentLocator('b',b).remember(other);assert.equal(createPaymentLocator('a',b).read(),id);
 assert.throws(()=>a.remember(other),/Nothing was sent/);
 a.forget(id);assert.equal(a.read(),null);assert.equal(createPaymentLocator('b',b).read(),other);
 assert.equal(new URL(b.location.href).searchParams.get('filter'),'all');
});
test('interleaved tabs retain both references and confirming one cannot erase the other',()=>{
 const a=browser(),b=browser();b.localStorage=a.localStorage;
 const one=createPaymentLocator('a',a),two=createPaymentLocator('a',b);
 const set=a.localStorage.setItem;let interleaved=false;
 a.localStorage.setItem=(k,v)=>{if(!interleaved){interleaved=true;two.remember(other);}set(k,v);};
 one.remember(id);
 assert.equal(one.read(),id);assert.equal(two.read(),other);
 one.forget(id);assert.equal(one.read(),other);assert.equal(two.read(),other);
 two.forget(other);assert.equal(one.read(),null);assert.equal(two.read(),null);
});
test('legacy locator remains readable until confirmed, without deleting another event',()=>{
 const a=browser();a.localStorage.setItem('ledgerly.payment-outcome:a',id);
 a.localStorage.setItem(`ledgerly.payment-outcome:a:event:${other}`,other);
 const locator=createPaymentLocator('a',a);assert.equal(locator.read(),id);
 locator.forget(id);assert.equal(locator.read(),other);
});
test('bookmarked company-scoped URL recovers without stored intent; storage failures block writes',()=>{
 const b=browser();b.location.href=`https://synthetic.invalid/payments?payment_company=a&payment_request=${id}`;
 assert.equal(createPaymentLocator('a',b).read(),id);assert.equal(createPaymentLocator('b',b).read(),null);
 b.localStorage.setItem=()=>{};assert.throws(()=>createPaymentLocator('a',b).remember(id),/Nothing was sent/);
});
