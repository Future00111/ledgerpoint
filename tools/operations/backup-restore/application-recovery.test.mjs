import test from 'node:test';
import assert from 'node:assert/strict';
import { assertApplicationArchive, assertApplicationRoles } from './application-recovery.mjs';
test('application recovery rejects existing/shared and redirected archive inputs', () => {
  const directory = '/tmp/ledgerly-accounting-flow-tests-Ab1234';
  assert.doesNotThrow(() => assertApplicationArchive({ directory, archive: `${directory}/synthetic-accounting.dump` }));
  for (const pair of [
    { directory: '/tmp/production', archive: '/tmp/production/synthetic-accounting.dump' },
    { directory, archive: '/tmp/other.dump' },
    { directory, archive: `${directory}/../synthetic-accounting.dump` },
    { directory: `${directory}/data`, archive: `${directory}/data/synthetic-accounting.dump` },
  ]) assert.throws(() => assertApplicationArchive(pair), /disposable accounting archive/);
});
test('restored application roles reject elevated flags, login owner and unexpected memberships', () => {
  const roles = ['ledgerly_api', 'ledgerly_bank_import_owner', 'ledgerly_canonical_owner'].map((rolname, i) => ({
    rolname, rolsuper: false, rolinherit: true, rolcreaterole: false, rolcreatedb: false,
    rolcanlogin: i === 0, rolreplication: false, rolbypassrls: false,
  }));
  assert.doesNotThrow(() => assertApplicationRoles(roles, []));
  for (const field of ['rolsuper','rolcreaterole','rolcreatedb','rolreplication','rolbypassrls']) {
    const changed = structuredClone(roles); changed[0][field] = true;
    assert.throws(() => assertApplicationRoles(changed, []), /restricted role contract/);
  }
  for (const index of [1,2]) {
    const changed=structuredClone(roles); changed[index].rolcanlogin=true;
    assert.throws(() => assertApplicationRoles(changed, []), /restricted role contract/);
  }
  assert.throws(() => assertApplicationRoles(roles, [{role_name:'ledgerly_bank_import_owner',member_name:'ledgerly_api',admin_option:false}]), /restricted role contract/);
  assert.throws(() => assertApplicationRoles(roles, [{role_name:'ledgerly_canonical_owner',member_name:'ledgerly_api',admin_option:false}]), /restricted role contract/);
  assert.throws(() => assertApplicationRoles(roles.slice(0,1), []), /restricted role contract/);
});
