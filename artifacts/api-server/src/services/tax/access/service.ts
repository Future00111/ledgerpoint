import { runSensitiveOperation, type SensitiveContext } from '../../payroll/access/boundary';
export { SensitiveAccessError } from '../../payroll/access/boundary';
export type { SensitiveRequest, SensitiveContext } from '../../payroll/access/boundary';

/** Submission-stage access never supplies HMRC consent or network authority. */
export const withPersonalTaxAccess = <T>(input: unknown, operation: (context: SensitiveContext) => Promise<T>) =>
  runSensitiveOperation('personal_tax', input, operation);
