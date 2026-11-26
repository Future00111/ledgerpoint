import { calculateDatedLoanPayslipDraft } from '../contracts/datedLoanPayslipDraft.mjs';

// Prepare the private line for an unqualified revision from the calculation inputs.
// The disposable storage boundary separately checks the effective pay record and tenant.
export function prepareDatedLoanLine({ lineId, employeeId, inputRevisionId, payday, calculation }) {
  const ids = [lineId, employeeId, inputRevisionId];
  if (!ids.every(id => typeof id === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) ||
      lineId === employeeId || lineId === inputRevisionId) throw new RangeError('Invalid review line references');
  if (calculation?.noticeContext?.employmentId !== employeeId || calculation.noticeContext.paymentDate !== payday) {
    throw new RangeError('Notice context must match the draft employee and payday');
  }
  const { payslip } = calculateDatedLoanPayslipDraft(calculation);
  const deductions = { paye: payslip.payeMinor, employee_ni: payslip.employeeNiMinor,
    student_loan: payslip.studentLoanMinor, postgraduate_loan: payslip.postgraduateLoanMinor };
  if (payslip.priorityOrderMinor !== undefined) deductions.priority_order = payslip.priorityOrderMinor;
  return { line_id: lineId, employee_id: employeeId, input_revision_id: inputRevisionId,
    gross: payslip.grossMinor, net: payslip.netMinor, deductions, adjustments: {} };
}
