/** W03 development fixtures, pending accounting acceptance; not VAT eligibility. */
export class DraftError extends Error {
  constructor(public status: number, public code: string, public path = "") {
    super(code);
  }
}
export function fail(status: number, code: string, path = ""): never {
  throw new DraftError(status, code, path);
}
export interface DraftLine {
  description: string;
  quantity: string;
  unit_price: string;
  tax_code: string;
}
export interface InvoiceSource {
  contract: "w03.draft.v1";
  currency: "GBP";
  customer_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  payment_terms: number;
  reference: string;
  notes: string;
  line_items: DraftLine[];
}
const fields = ["contract", "currency", "customer_id", "invoice_number", "issue_date",
  "due_date", "payment_terms", "reference", "notes", "line_items"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) fail(400, "INVALID_REQUEST_SHAPE");
  return value as string;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(400, "INVALID_REQUEST_SHAPE");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) fail(422, "FIELD_INVALID", "/unknown_field");
}
function text(value: unknown, max: number, path: string, nonempty = false, multiline = false): string {
  if (typeof value !== "string" || value.length > max ||
      (nonempty && !value.trim()) ||
      (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(value)) {
    fail(422, "FIELD_INVALID", path);
  }
  return nonempty ? (value as string).trim() : value as string;
}
export const MAX_PENCE = 999999999999n;
export function decimal(value: unknown, quantity: boolean): bigint {
  if (typeof value !== "string") fail(422, "DECIMAL_REQUIRED");
  if (value.length > 20 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/.test(value)) fail(422, "DECIMAL_INVALID");
  const [whole, part = ""] = (value as string).split(".");
  const n = BigInt(whole!) * 10000n + BigInt(part.padEnd(4, "0"));
  if (quantity ? n <= 0n || n > 9999999999n : n > 999999999999n) {
    fail(422, quantity ? "QUANTITY_RANGE" : "UNIT_PRICE_RANGE");
  }
  return n;
}
function date(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value < "1900-01-01" || value > "2199-12-31" ||
      !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) fail(422, "FIELD_INVALID", path);
  return value as string;
}
export function parseInvoice(body: unknown, previous?: InvoiceSource): InvoiceSource {
  const input = object(body);
  keys(input, previous ? fields.filter(k => k !== "currency") : fields);
  if (input.contract !== "w03.draft.v1") fail(422, "FIELD_INVALID", "/contract");
  if (previous && Object.keys(input).length < 2) fail(422, "FIELD_INVALID");
  const data = { ...previous, ...input };
  if (data.currency !== "GBP") fail(422, "FIELD_INVALID", "/currency");
  const issue = date(data.issue_date, "/issue_date"), due = date(data.due_date, "/due_date");
  if (due < issue || !Number.isInteger(data.payment_terms) ||
      Number(data.payment_terms) < 0 || Number(data.payment_terms) > 365) fail(422, "FIELD_INVALID");
  if (!Array.isArray(data.line_items) || data.line_items.length < 1 || data.line_items.length > 200) {
    fail(422, "LINES_RANGE", "/line_items");
  }
  const lines = (data.line_items as unknown[]).map((line, i) => {
    const l = object(line);
    keys(l, ["description", "quantity", "unit_price", "tax_code"]);
    decimal(l.quantity, true); decimal(l.unit_price, false);
    return { description: text(l.description, 500, `/line_items/${i}/description`, true),
      quantity: l.quantity as string, unit_price: l.unit_price as string,
      tax_code: text(l.tax_code, 64, `/line_items/${i}/tax_code`, true) };
  });
  return { contract: "w03.draft.v1", currency: "GBP", customer_id: uuid(data.customer_id),
    invoice_number: text(data.invoice_number, 64, "/invoice_number", true),
    issue_date: issue, due_date: due, payment_terms: data.payment_terms as number,
    reference: text(data.reference === undefined ? "" : data.reference, 200, "/reference"),
    notes: text(data.notes === undefined ? "" : data.notes, 4000, "/notes", false, true),
    line_items: lines.map(line => ({ ...line, tax_code: line.tax_code.toUpperCase() })) };
}
export function netPence(lines: DraftLine[]): bigint[] {
  return lines.map((l, index) => {
    const product = decimal(l.quantity, true) * decimal(l.unit_price, false);
    if (product % 1000000n !== 0n) fail(422, "ROUNDING_POLICY_REQUIRED", `/line_items/${index}`);
    const n = product / 1000000n;
    if (n > MAX_PENCE) fail(422, "MONEY_LIMIT");
    return n;
  });
}
export function money(net: bigint[], authoritativeVat: string[]) {
  if (net.length !== authoritativeVat.length) fail(503, "AUTHORITY_UNAVAILABLE");
  const lines = net.map((n, i) => {
    const raw = authoritativeVat[i];
    if (typeof raw !== "string" || !/^(0|[1-9]\d{0,11})$/.test(raw)) fail(503, "AUTHORITY_UNAVAILABLE");
    const vat = BigInt(raw!), gross = n + vat;
    if (vat > MAX_PENCE || gross > MAX_PENCE) fail(422, "MONEY_LIMIT");
    return { net_pence: n.toString(), vat_pence: vat.toString(), gross_pence: gross.toString() };
  });
  const sum = (key: keyof typeof lines[number]) => {
    const n = lines.reduce((s, l) => s + BigInt(l[key]), 0n);
    if (n > MAX_PENCE) fail(422, "MONEY_LIMIT");
    return n.toString();
  };
  return { currency: "GBP", net_pence: sum("net_pence"), vat_pence: sum("vat_pence"),
    gross_pence: sum("gross_pence"), lines };
}
export function canWriteDraft(role: unknown, active: unknown): boolean {
  // No configured grant storage exists yet. Manager writes deliberately disabled.
  return active === true && typeof role === "string" && ["owner", "admin", "accountant"].includes(role);
}
/** JSON.parse alone loses duplicate keys. Check the already bounded raw JSON. */
export function checkDraftJson(raw: string) {
  try { JSON.parse(raw); } catch { fail(400, "MALFORMED_JSON"); }
  const tokens = raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  let index = 0;
  const value = (): void => {
    const token = tokens[index++];
    if (token === "{") {
      const seen = new Set<string>();
      if (tokens[index] === "}") { index++; return; }
      do {
        const key = JSON.parse(tokens[index++]!);
        if (seen.has(key)) fail(400, "DUPLICATE_KEY");
        seen.add(key); index++; value();
      } while (tokens[index++] === ",");
    } else if (token === "[") {
      if (tokens[index] === "]") { index++; return; }
      do { value(); } while (tokens[index++] === ",");
    }
  };
  try { value(); } catch (e) {
    if (e instanceof DraftError) throw e;
    fail(400, "INVALID_REQUEST_SHAPE");
  }
}
