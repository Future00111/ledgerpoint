export interface WorkspaceTaxRule {
  code: string;
  label: string;
  rate: number;
  treatment: string;
}
export const workspaceTaxRules: WorkspaceTaxRule[];
export function ensureWorkspaceTaxRules(
  q: { query(text: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }> },
  company: string,
): Promise<string[]>;
