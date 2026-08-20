import assert from "node:assert/strict";
import test from "node:test";
import { calculateVATBoxes, isAdjustableVATBox } from "./vatMath.js";
import { genericEntityWriteError, isGenericEntityWriteBlocked } from "../../routes/entityWritePolicy.js";

const p = (value: number) => Math.round(value * 100);
const money = (value: number) => value / 100;

const scenarios = [
  ["standard-rate sales", [{ 1: p(20), 6: p(100) }], { 1: 20, 3: 20, 5: 20, 6: 100 }],
  ["reduced-rate sales", [{ 1: p(5), 6: p(100) }], { 1: 5, 3: 5, 5: 5 }],
  ["zero-rate sales", [{ 1: 0, 6: p(100) }], { 1: 0, 6: 100 }],
  ["exempt sales", [{ 1: 0, 6: p(100) }], { 1: 0, 6: 100 }],
  ["no-VAT purchase", [{ 4: 0, 7: p(50) }], { 4: 0, 7: 50 }],
  ["input VAT reclaim", [{ 4: p(20), 7: p(100) }], { 4: 20, 5: -20, 7: 100 }],
  ["sales credit note", [{ 1: -p(20), 6: -p(100) }], { 1: -20, 3: -20, 5: -20, 6: -100 }],
  ["supplier credit note", [{ 4: -p(20), 7: -p(100) }], { 4: -20, 5: 20, 7: -100 }],
  ["mixed sales and purchase", [{ 1: p(40), 6: p(200) }, { 4: p(20), 7: p(100) }], { 3: 40, 4: 20, 5: 20 }],
  ["box 2 feeds box 3", [{ 1: p(10), 2: p(5) }], { 3: 15, 5: 15 }],
  ["box 8 retained", [{ 8: p(200) }], { 8: 200 }],
  ["box 9 retained", [{ 9: p(300) }], { 9: 300 }],
  ["positive manual box 1 adjustment", [{ 1: p(12) }], { 1: 12, 3: 12, 5: 12 }],
  ["negative manual box 4 adjustment", [{ 4: -p(9) }], { 4: -9, 5: 9 }],
  ["manual box 6 adjustment", [{ 6: p(45) }], { 6: 45, 5: 0 }],
  ["manual box 7 adjustment", [{ 7: p(45) }], { 7: 45, 5: 0 }],
  ["rounding in pence", [{ 1: 1 }, { 4: 1 }], { 1: 0.01, 4: 0.01, 5: 0 }],
  ["multiple output sources", [{ 1: p(10) }, { 1: p(15) }], { 1: 25, 3: 25, 5: 25 }],
  ["multiple input sources", [{ 4: p(10) }, { 4: p(15) }], { 4: 25, 5: -25 }],
  ["output credit offsets invoice", [{ 1: p(20) }, { 1: -p(5) }], { 1: 15, 3: 15, 5: 15 }],
  ["input credit offsets bill", [{ 4: p(20) }, { 4: -p(5) }], { 4: 15, 5: -15 }],
  ["blank return", [], { 1: 0, 3: 0, 4: 0, 5: 0 }],
  ["all nine boxes can coexist", [{ 1: p(1), 2: p(2), 4: p(3), 6: p(4), 7: p(5), 8: p(6), 9: p(7) }], { 3: 3, 5: 0, 8: 6, 9: 7 }],
] as const;

for (const [name, contributions, expected] of scenarios) {
  test(`VAT scenario: ${name}`, () => {
    const result = calculateVATBoxes(contributions);
    for (const [box, amount] of Object.entries(expected)) {
      assert.equal(money(result[Number(box)]), amount);
    }
  });
}

test("VAT scenario: derived boxes cannot be manual adjustments", () => {
  assert.equal(isAdjustableVATBox(3), false);
  assert.equal(isAdjustableVATBox(5), false);
  assert.equal(isAdjustableVATBox(1), true);
  assert.equal(isAdjustableVATBox(9), true);
});

test("VAT scenario: generic entity writes cannot bypass the VAT workflow", () => {
  assert.equal(isGenericEntityWriteBlocked("VATReturn"), true);
  assert.match(genericEntityWriteError("VATReturn"), /cannot be changed through generic entity routes/);
  assert.equal(isGenericEntityWriteBlocked("SalesInvoice"), false);
});