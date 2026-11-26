export function prepareDatedLoanLine(input: {
  lineId: string;
  employeeId: string;
  inputRevisionId: string;
  payday: string;
  calculation: unknown;
}): {
  line_id: string;
  employee_id: string;
  input_revision_id: string;
  gross: string;
  net: string;
  deductions: Record<string,string>;
  adjustments: Record<string,string>;
};
