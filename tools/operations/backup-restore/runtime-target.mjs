import path from 'node:path';

// Only the two disposable clusters created by the accounting restore runner.
// Never accept a caller's database URL, role, port or database name.
export function applicationRuntimeTarget(phase, socket) {
  const prepare = phase === 'prepare';
  const pattern = prepare ? /^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/ :
    /^\/tmp\/ledgerpoint-application-recovery-[A-Za-z0-9]{6}\/socket$/;
  if (!['prepare', 'verify'].includes(phase) || typeof socket !== 'string' || !pattern.test(socket))
    throw new Error('Fresh disposable application runtime socket required.');
  const port = prepare ? 55441 : 55443;
  const database = prepare ? 'ledgerly_accounting_flow_test' : 'postgres';
  return { directory: path.dirname(socket), socket, port, database,
    url: `postgresql://ledgerly_api@localhost/${database}?host=${encodeURIComponent(socket)}&port=${port}&options=-c%20timezone%3DUTC` };
}
