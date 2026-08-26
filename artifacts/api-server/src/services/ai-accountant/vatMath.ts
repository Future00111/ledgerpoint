/** Dependency-free UK VAT box arithmetic. All values are integer pence. */
export type VATBoxMap = Record<number, number>;
export const ADJUSTABLE_VAT_BOXES = new Set([1, 2, 4, 6, 7, 8, 9]);
export const isAdjustableVATBox = (boxNumber: number) => ADJUSTABLE_VAT_BOXES.has(boxNumber);

export function calculateVATBoxes(contributions: ReadonlyArray<Partial<VATBoxMap>>) {
  const boxes: VATBoxMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  for (const contribution of contributions) {
    for (const [box, amount] of Object.entries(contribution)) boxes[Number(box)] += amount ?? 0;
  }
  boxes[3] = boxes[1] + boxes[2];
  boxes[5] = boxes[3] - boxes[4];
  return boxes;
}