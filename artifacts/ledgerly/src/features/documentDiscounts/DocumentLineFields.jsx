import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/accounting/AccountingUI';

/** Controlled native line fields. Discount credits retain the full original source. */
export default function DocumentLineFields({ line, index, credit, discountMode, originalDiscount, priceBasis, taxRules, originalLine, originalLineRef, money, canRemove, onChange, onRemove }) {
  const overQuantity = originalLine && Number(line.quantity) > Number(originalLine.quantity);
  const overPrice = originalLine && Number(line.unit_price) > Number(originalLine.unit_price);
  return <div className="grid gap-3 border-b pb-5 sm:grid-cols-12" data-testid={`row-line-${index}`}>
    <div className="sm:col-span-12"><Label htmlFor={`d${index}`}>Description</Label><Input id={`d${index}`} required className="mt-1" value={line.description} readOnly={credit} onChange={event => onChange('description', event.target.value)} /></div>
    <div className="sm:col-span-3"><Label htmlFor={`q${index}`}>{discountMode ? 'Original quantity' : 'Quantity'}</Label><Input id={`q${index}`} data-testid={`input-qty-${index}`} required readOnly={discountMode} inputMode="decimal" className="mt-1" value={line.quantity} onChange={event => onChange('quantity', event.target.value)} />
      {credit && originalLine && <p className={`mt-1 text-xs ${overQuantity ? 'text-red-700' : 'text-muted-foreground'}`}>Original line {originalLineRef + 1}: max {originalLine.quantity} at {originalLine.unit_price} ({originalLine.tax_code})</p>}</div>
    <div className="sm:col-span-4"><Label htmlFor={`p${index}`}>{discountMode ? 'Original unit price' : credit ? originalDiscount ? 'Credit per unit before original discount' : 'Credit per unit' : 'Unit price'} ({priceBasis === 'including_vat' ? 'inc' : 'exc'} VAT)</Label><Input id={`p${index}`} data-testid={`input-unit-price-${index}`} required readOnly={discountMode} inputMode="decimal" className="mt-1" value={line.unit_price} onChange={event => onChange('unit_price', event.target.value)} />
      {credit && !discountMode && <p className={`mt-1 text-xs ${overPrice ? 'text-red-700' : 'text-muted-foreground'}`}>{originalDiscount ? 'The original discount is applied to these entered prices. Save to see the exact net, VAT and total credit.' : <>Enter the amount to credit per unit, up to the original unit price. {priceBasis === 'including_vat' ? 'For a £10 total credit, enter quantity 1 and £10.' : 'VAT is added to the entered credit, using the original tax rate.'}</>}</p>}</div>
    <div className="sm:col-span-5"><Label htmlFor={`t${index}`}>VAT rate</Label><select id={`t${index}`} required className="mt-1 w-full rounded-md border bg-background p-2.5 text-sm" value={line.tax_code} disabled={credit} onChange={event => onChange('tax_code', event.target.value)}>
      <option value="">Select</option>{line.tax_code && !taxRules.some(rule => rule.code === line.tax_code) && <option value={line.tax_code}>{line.tax_code}</option>}
      {taxRules.map(rule => <option key={rule.id ?? rule.code} value={rule.code}>{Number(rule.rate)}% · {rule.label}</option>)}
    </select></div>
    {money && <p className="sm:col-span-12 text-right text-xs text-muted-foreground">{discountMode ? 'Allocated credit: ' : ''}Net <Money value={money.net_pence} /> · VAT <Money value={money.vat_pence} /> · Gross <Money value={money.gross_pence} /></p>}
    {canRemove && !discountMode && <button type="button" data-testid={`button-remove-line-${index}`} className="sm:col-span-12 justify-self-end text-xs text-destructive" onClick={onRemove}>{credit ? 'Exclude from credit' : 'Remove line'}</button>}
  </div>;
}
