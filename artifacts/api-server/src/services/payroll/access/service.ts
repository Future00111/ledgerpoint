import { runSensitiveOperation, type SensitiveContext } from './boundary';
export { SensitiveAccessError } from './boundary';
export type { SensitiveRequest, SensitiveContext } from './boundary';

/** Salary, identifier and bank-record operations require a current payroll-specific right. */
export const withPayrollAccess = <T>(input: unknown, operation: (context: SensitiveContext) => Promise<T>) =>
  runSensitiveOperation('payroll', input, operation);
