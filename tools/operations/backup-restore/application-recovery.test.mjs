import test from 'node:test';
import assert from 'node:assert/strict';
import { assertApplicationArchive, assertApplicationRoles, assertPaymentAttemptRecovery } from './application-recovery.mjs';
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
test('application restore cannot qualify an absent, partial or malformed native payment-attempt receipt', () => {
  const good = { paymentAttemptRecovery: { states: ['pending', 'no_effect', 'recorded'],
    persistedRequestBindings: true, restoredPendingClosed: true, terminalRequestsFenced: true,
    recordedReplaySingleEffect: true, readOnlyDiscoveryPreserved: true, unknownAndCrossCompanyIsolated: true,
    immutableRuntimeHistory: true } };
  assert.doesNotThrow(() => assertPaymentAttemptRecovery(good));
  for (const value of [undefined, null, {}, { paymentAttemptRecovery: null }])
    assert.throws(() => assertPaymentAttemptRecovery(value), /acceptance is missing or incomplete/);
  for (const key of Object.keys(good.paymentAttemptRecovery).filter(key => key !== 'states')) {
    for (const value of [undefined, false, 'true', 1, null]) {
      const changed = structuredClone(good); changed.paymentAttemptRecovery[key] = value;
      assert.throws(() => assertPaymentAttemptRecovery(changed), /acceptance is missing or incomplete/);
    }
  }
  for (const value of [[], ['recorded'], ['pending', 'no_effect', 'pending'],
    ['recorded', 'no_effect', 'pending'], ['pending', 'no_effect', 'recorded', 'unknown'], 'pending,no_effect,recorded']) {
    const changed = structuredClone(good); changed.paymentAttemptRecovery.states = value;
    assert.throws(() => assertPaymentAttemptRecovery(changed), /acceptance is missing or incomplete/);
  }
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
