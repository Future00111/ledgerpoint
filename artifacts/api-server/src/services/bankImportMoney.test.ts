import test from 'node:test';
import assert from 'node:assert/strict';
import {bankImportPence,bankImportSides} from './bankImportMoney';
test('statement money preserves exact pennies and schema bounds without rounding',()=>{
  for(const [value,expected] of [[null,0],['',0],['1.01',101],[19.99,1999],[' 100.20 ',10020],['9999999999.99',999999999999]] as const)
    assert.equal(bankImportPence(value),expected);
  for(const value of ['1.001',0.005,'1e2',true,[],{},'-1','NaN',Infinity,'10000000000.00'])
    assert.throws(()=>bankImportPence(value));
});
test('statement entries have exactly one positive side',()=>{
  assert.deepEqual(bankImportSides({money_in:'1.01'}),{inPence:101,outPence:0});
  assert.deepEqual(bankImportSides({money_out:'2.02'}),{inPence:0,outPence:202});
  for(const row of [{},{money_in:'0',money_out:0},{money_in:1,money_out:2}])
    assert.throws(()=>bankImportSides(row));
});
