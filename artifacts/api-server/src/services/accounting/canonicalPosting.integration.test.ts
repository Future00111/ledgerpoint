import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  accountingAuditEventsTable,
  accountingPostingEffectsTable,
  canonicalJournalEntriesTable,
  canonicalJournalLinesTable,
  canonicalJournalRelationsTable,
  chartOfAccountsTable,
  companiesTable,
  companyUsersTable,
} from "@workspace/db/schema";
import {
  CanonicalPostingError,
  correctCanonicalJournal,
  postCanonicalJournal,
  reverseCanonicalJournal,
  type CanonicalPostingCommand,
  type CanonicalPostingDependencies,
} from "./canonicalPosting.js";

interface FixtureState {
  companyId: string;
  revision: string;
  periodStatus: "OPEN" | "CLOSED";
  configurationVersionId: string;
  accountIds: string[];
  accountCompanies?: Record<string, string>;
  lines: Array<{ accountId: string; debitMinor: number; creditMinor: number }>;
}

function dependencies(state: FixtureState): CanonicalPostingDependencies {
  return {
    sourceProvider: {
      async getCurrent(command) {
        return {
          companyId: state.companyId,
          sourceType: command.sourceType,
          sourceId: command.sourceId,
          status: "approved",
          isPostable: true,
          sourceRevision: state.revision,
          evidenceHash: `evidence-${state.revision}`,
        };
      },
    },
    contextProvider: {
      async resolve() {
        return {
          companyId: state.companyId,
          financialYearId: "FY-2026",
          accountingPeriodId: "P-2026-04",
          periodStatus: state.periodStatus,
          configurationVersionId: state.configurationVersionId,
          currencyCode: "GBP",
          accounts: Object.fromEntries(
            state.accountIds.map((id) => [
              id,
              {
                id,
                companyId: state.accountCompanies?.[id] ?? state.companyId,
                isActive: true,
                isEligible: true,
                currencyCode: "GBP",
              },
            ]),
          ),
        };
      },
    },
    lineBuilder: {
      async build() {
        return state.lines;
      },
    },
  };
}

function command(input: {
  companyId?: string;
  userId: string;
  effect: string;
  key: string;
  revision?: string;
}): CanonicalPostingCommand {
  const revision = input.revision ?? "rev-1";
  return {
    principal: { kind: "user", userId: input.userId, requestedCompanyId: input.companyId },
    requestedCompanyId: input.companyId,
    sourceType: "fixture_document",
    sourceId: `source-${input.effect}`,
    sourceRevision: revision,
    sourceEvidenceHash: `evidence-${revision}`,
    postingKind: "fixture_posting",
    economicEffectId: input.effect,
    idempotencyKey: input.key,
    postingDate: "2026-04-10",
    configurationVersionId: "config-v1",
    currencyCode: "GBP",
    description: "Fixture canonical posting",
    reference: "fixture-ref",
  };
}

async function createCompany(label: string) {
  const [company] = await db
    .insert(companiesTable)
    .values({ name: `Canonical posting ${label} ${randomUUID()}` })
    .returning();
  assert.ok(company);
  return company;
}

async function addAccount(companyId: string, name: string) {
  const [account] = await db
    .insert(chartOfAccountsTable)
    .values({ company_id: companyId, name, code: `T-${randomUUID().slice(0, 8)}`, is_active: true })
    .returning();
  assert.ok(account);
  return account;
}

async function addMembership(companyId: string, userId: string, role: string) {
  await db.insert(companyUsersTable).values({
    company_id: companyId,
    user_id: userId,
    role,
    is_active: true,
  });
}

async function cleanCompanies(companyIds: string[]) {
  await db.delete(accountingAuditEventsTable).where(inArray(accountingAuditEventsTable.company_id, companyIds));
  await db.delete(canonicalJournalRelationsTable).where(inArray(canonicalJournalRelationsTable.company_id, companyIds));
  await db.delete(canonicalJournalLinesTable).where(inArray(canonicalJournalLinesTable.company_id, companyIds));
  await db.delete(accountingPostingEffectsTable).where(inArray(accountingPostingEffectsTable.company_id, companyIds));
  await db.delete(canonicalJournalEntriesTable).where(inArray(canonicalJournalEntriesTable.company_id, companyIds));
  await db.delete(chartOfAccountsTable).where(inArray(chartOfAccountsTable.company_id, companyIds));
  await db.delete(companyUsersTable).where(inArray(companyUsersTable.company_id, companyIds));
  await db.delete(companiesTable).where(inArray(companiesTable.id, companyIds));
}

async function expectCode(
  action: () => Promise<unknown>,
  code: CanonicalPostingError["code"],
) {
  await assert.rejects(action, (error: unknown) =>
    error instanceof CanonicalPostingError && error.code === code,
  );
}

async function expectDatabaseCode(
  action: () => Promise<unknown>,
  code: string,
) {
  function findCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
      return (error as { code: string }).code;
    }
    return "cause" in error
      ? findCode((error as { cause?: unknown }).cause)
      : undefined;
  }

  await assert.rejects(action, (error: unknown) => findCode(error) === code);
}

test("canonical posting persists a balanced immutable journal, audit, and retry-safe effect", async (t) => {
  const company = await createCompany("happy-path");
  const owner = `canonical-owner-${randomUUID()}`;
  const debit = await addAccount(company.id, "Fixture debit");
  const credit = await addAccount(company.id, "Fixture credit");
  await addMembership(company.id, owner, "owner");
  t.after(() => cleanCompanies([company.id]));

  const state: FixtureState = {
    companyId: company.id,
    revision: "rev-1",
    periodStatus: "OPEN",
    configurationVersionId: "config-v1",
    accountIds: [debit.id, credit.id],
    lines: [
      { accountId: debit.id, debitMinor: 12500, creditMinor: 0 },
      { accountId: credit.id, debitMinor: 0, creditMinor: 12500 },
    ],
  };
  const firstCommand = command({
    companyId: company.id,
    userId: owner,
    effect: `effect-${randomUUID()}`,
    key: `key-${randomUUID()}`,
  });

  const posted = await postCanonicalJournal(firstCommand, dependencies(state));
  const retry = await postCanonicalJournal(firstCommand, dependencies(state));
  assert.equal(posted.status, "posted");
  assert.equal(retry.status, "duplicate");
  assert.equal(retry.journalId, posted.journalId);

  const [journal] = await db
    .select()
    .from(canonicalJournalEntriesTable)
    .where(eq(canonicalJournalEntriesTable.id, posted.journalId));
  assert.equal(journal?.status, "posted");
  assert.equal(journal?.total_debit_minor, "12500");
  assert.equal(journal?.total_credit_minor, "12500");
  assert.equal(journal?.company_id, company.id);

  const lines = await db
    .select()
    .from(canonicalJournalLinesTable)
    .where(eq(canonicalJournalLinesTable.journal_entry_id, posted.journalId));
  assert.equal(lines.length, 2);
  assert.deepEqual(
    lines.map((line) => [line.debit_minor, line.credit_minor]).sort(),
    [["0", "12500"], ["12500", "0"]],
  );
  const audits = await db
    .select()
    .from(accountingAuditEventsTable)
    .where(eq(accountingAuditEventsTable.journal_id, posted.journalId));
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.capability, "accounting.post");

  await expectCode(
    () =>
      postCanonicalJournal(
        {
          ...firstCommand,
          idempotencyKey: `key-${randomUUID()}`,
        },
        dependencies(state),
      ),
    "duplicate_conflict",
  );
});

test("canonical posting fails closed for stale sources, closed periods, invalid accounts, and company mismatch", async (t) => {
  const companyA = await createCompany("failure-A");
  const companyB = await createCompany("failure-B");
  const ownerA = `canonical-owner-${randomUUID()}`;
  const debitA = await addAccount(companyA.id, "Fixture debit A");
  const creditA = await addAccount(companyA.id, "Fixture credit A");
  const accountB = await addAccount(companyB.id, "Fixture other company account");
  await addMembership(companyA.id, ownerA, "owner");
  t.after(() => cleanCompanies([companyA.id, companyB.id]));

  const base = {
    companyId: companyA.id,
    revision: "rev-1",
    periodStatus: "OPEN" as const,
    configurationVersionId: "config-v1",
    accountIds: [debitA.id, creditA.id],
    lines: [
      { accountId: debitA.id, debitMinor: 100, creditMinor: 0 },
      { accountId: creditA.id, debitMinor: 0, creditMinor: 100 },
    ],
  };

  await expectCode(
    () =>
      postCanonicalJournal(
        command({
          companyId: companyA.id,
          userId: ownerA,
          effect: `stale-${randomUUID()}`,
          key: `stale-${randomUUID()}`,
        }),
        dependencies({ ...base, revision: "rev-2" }),
      ),
    "source_stale",
  );
  await expectCode(
    () =>
      postCanonicalJournal(
        command({
          companyId: companyA.id,
          userId: ownerA,
          effect: `closed-${randomUUID()}`,
          key: `closed-${randomUUID()}`,
        }),
        dependencies({ ...base, periodStatus: "CLOSED" }),
      ),
    "context_invalid",
  );
  await expectCode(
    () =>
      postCanonicalJournal(
        command({
          companyId: companyA.id,
          userId: ownerA,
          effect: `account-${randomUUID()}`,
          key: `account-${randomUUID()}`,
        }),
        dependencies({
          ...base,
          accountIds: [debitA.id, creditA.id, accountB.id],
          accountCompanies: { [accountB.id]: companyB.id },
          lines: [
            { accountId: accountB.id, debitMinor: 100, creditMinor: 0 },
            { accountId: creditA.id, debitMinor: 0, creditMinor: 100 },
          ],
        }),
      ),
    "account_invalid",
  );
  await expectCode(
    () =>
      postCanonicalJournal(
        command({
          companyId: companyB.id,
          userId: ownerA,
          effect: `scope-${randomUUID()}`,
          key: `scope-${randomUUID()}`,
        }),
        dependencies(base),
      ),
    "authorization_failed",
  );

  const journals = await db
    .select()
    .from(canonicalJournalEntriesTable)
    .where(eq(canonicalJournalEntriesTable.company_id, companyA.id));
  assert.equal(journals.length, 0);
});

test("canonical posting is atomic under audit failure, concurrent retries, and additive reversal", async (t) => {
  const company = await createCompany("atomicity");
  const owner = `canonical-owner-${randomUUID()}`;
  const debit = await addAccount(company.id, "Fixture debit");
  const credit = await addAccount(company.id, "Fixture credit");
  await addMembership(company.id, owner, "accountant");
  t.after(() => cleanCompanies([company.id]));

  const state: FixtureState = {
    companyId: company.id,
    revision: "rev-1",
    periodStatus: "OPEN",
    configurationVersionId: "config-v1",
    accountIds: [debit.id, credit.id],
    lines: [
      { accountId: debit.id, debitMinor: 999, creditMinor: 0 },
      { accountId: credit.id, debitMinor: 0, creditMinor: 999 },
    ],
  };
  const failureCommand = command({
    companyId: company.id,
    userId: owner,
    effect: `failure-${randomUUID()}`,
    key: `failure-${randomUUID()}`,
  });
  await assert.rejects(
    () =>
      postCanonicalJournal(failureCommand, {
        ...dependencies(state),
        hooks: {
          async beforeAuditInsert() {
            throw new Error("injected audit failure");
          },
        },
      }),
    /injected audit failure/,
  );
  const failedEffects = await db
    .select()
    .from(accountingPostingEffectsTable)
    .where(eq(accountingPostingEffectsTable.economic_effect_id, failureCommand.economicEffectId));
  assert.equal(failedEffects.length, 0);

  const concurrentCommand = command({
    companyId: company.id,
    userId: owner,
    effect: `concurrent-${randomUUID()}`,
    key: `concurrent-${randomUUID()}`,
  });
  const concurrent = await Promise.all(
    Array.from({ length: 6 }, () => postCanonicalJournal(concurrentCommand, dependencies(state))),
  );
  assert.equal(new Set(concurrent.map((result) => result.journalId)).size, 1);
  assert.equal(concurrent.filter((result) => result.status === "posted").length, 1);

  const reversal = await reverseCanonicalJournal(
    {
      principal: { kind: "user", userId: owner, requestedCompanyId: company.id },
      requestedCompanyId: company.id,
      originalJournalId: concurrent[0]!.journalId,
      reason: "Fixture reversal",
      postingDate: "2026-04-11",
      economicEffectId: `reversal-${randomUUID()}`,
      idempotencyKey: `reversal-${randomUUID()}`,
      configurationVersionId: "config-v1",
    },
    dependencies(state),
  );
  assert.notEqual(reversal.journalId, concurrent[0]!.journalId);
  const [original, reversed] = await Promise.all([
    db.select().from(canonicalJournalEntriesTable).where(eq(canonicalJournalEntriesTable.id, concurrent[0]!.journalId)),
    db.select().from(canonicalJournalEntriesTable).where(eq(canonicalJournalEntriesTable.id, reversal.journalId)),
  ]);
  assert.equal(original[0]?.status, "posted");
  assert.equal(reversed[0]?.reversal_of_id, original[0]?.id);
  const relations = await db
    .select()
    .from(canonicalJournalRelationsTable)
    .where(
      and(
        eq(canonicalJournalRelationsTable.original_journal_id, concurrent[0]!.journalId),
        eq(canonicalJournalRelationsTable.related_journal_id, reversal.journalId),
      ),
    );
  assert.equal(relations.length, 1);
  assert.equal(relations[0]?.relation_type, "reversal");
  const [reversalEffect] = await db
    .select()
    .from(accountingPostingEffectsTable)
    .where(eq(accountingPostingEffectsTable.id, reversal.effectId));
  assert.equal(relations[0]?.economic_effect_id, reversalEffect?.economic_effect_id);

  const correction = await correctCanonicalJournal(
    {
      principal: { kind: "user", userId: owner, requestedCompanyId: company.id },
      requestedCompanyId: company.id,
      originalJournalId: concurrent[0]!.journalId,
      reason: "Fixture correction",
      postingDate: "2026-04-12",
      economicEffectId: `correction-${randomUUID()}`,
      idempotencyKey: `correction-${randomUUID()}`,
      configurationVersionId: "config-v1",
      replacementDescription: "Fixture corrected journal",
    },
    dependencies(state),
  );
  const correctionRelations = await db
    .select()
    .from(canonicalJournalRelationsTable)
    .where(
      and(
        eq(canonicalJournalRelationsTable.original_journal_id, concurrent[0]!.journalId),
        eq(canonicalJournalRelationsTable.related_journal_id, correction.journalId),
      ),
    );
  assert.equal(correctionRelations.length, 1);
  assert.equal(correctionRelations[0]?.relation_type, "correction");
  const [correctionEffect] = await db
    .select()
    .from(accountingPostingEffectsTable)
    .where(eq(accountingPostingEffectsTable.id, correction.effectId));
  assert.equal(correctionRelations[0]?.economic_effect_id, correctionEffect?.economic_effect_id);
});

test("SC-01 enforces company-scoped relation identity, uniqueness, and atomic rollback", async (t) => {
  const company = await createCompany("sc-01");
  const otherCompany = await createCompany("sc-01-other");
  const owner = `canonical-owner-${randomUUID()}`;
  const debit = await addAccount(company.id, "SC-01 debit");
  const credit = await addAccount(company.id, "SC-01 credit");
  await addMembership(company.id, owner, "owner");
  t.after(() => cleanCompanies([company.id, otherCompany.id]));

  const state: FixtureState = {
    companyId: company.id,
    revision: "rev-1",
    periodStatus: "OPEN",
    configurationVersionId: "config-v1",
    accountIds: [debit.id, credit.id],
    lines: [
      { accountId: debit.id, debitMinor: 500, creditMinor: 0 },
      { accountId: credit.id, debitMinor: 0, creditMinor: 500 },
    ],
  };

  const originalCommand = command({
    companyId: company.id,
    userId: owner,
    effect: `sc-01-original-${randomUUID()}`,
    key: `sc-01-original-${randomUUID()}`,
  });
  const original = await postCanonicalJournal(originalCommand, dependencies(state));

  const reversalCommand = {
    principal: { kind: "user" as const, userId: owner, requestedCompanyId: company.id },
    requestedCompanyId: company.id,
    originalJournalId: original.journalId,
    reason: "SC-01 reversal",
    postingDate: "2026-04-11",
    economicEffectId: `sc-01-reversal-${randomUUID()}`,
    idempotencyKey: `sc-01-reversal-${randomUUID()}`,
    configurationVersionId: "config-v1",
  };
  const reversal = await reverseCanonicalJournal(reversalCommand, dependencies(state));
  const reversalRetry = await reverseCanonicalJournal(reversalCommand, dependencies(state));
  assert.equal(reversalRetry.journalId, reversal.journalId);
  assert.equal(reversalRetry.effectId, reversal.effectId);

  const correctionCommand = {
    principal: { kind: "user" as const, userId: owner, requestedCompanyId: company.id },
    requestedCompanyId: company.id,
    originalJournalId: original.journalId,
    reason: "SC-01 correction",
    postingDate: "2026-04-12",
    economicEffectId: `sc-01-correction-${randomUUID()}`,
    idempotencyKey: `sc-01-correction-${randomUUID()}`,
    configurationVersionId: "config-v1",
    replacementDescription: "SC-01 corrected journal",
  };
  const correction = await correctCanonicalJournal(correctionCommand, dependencies(state));
  const correctionRetry = await correctCanonicalJournal(correctionCommand, dependencies(state));
  assert.equal(correctionRetry.journalId, correction.journalId);
  assert.equal(correctionRetry.effectId, correction.effectId);

  const [reversalRelation] = await db
    .select()
    .from(canonicalJournalRelationsTable)
    .where(eq(canonicalJournalRelationsTable.related_journal_id, reversal.journalId));
  const [correctionRelation] = await db
    .select()
    .from(canonicalJournalRelationsTable)
    .where(eq(canonicalJournalRelationsTable.related_journal_id, correction.journalId));
  const [reversalEffect] = await db
    .select()
    .from(accountingPostingEffectsTable)
    .where(eq(accountingPostingEffectsTable.id, reversal.effectId));
  const [correctionEffect] = await db
    .select()
    .from(accountingPostingEffectsTable)
    .where(eq(accountingPostingEffectsTable.id, correction.effectId));
  assert.equal(reversalRelation?.economic_effect_id, reversalEffect?.economic_effect_id);
  assert.equal(correctionRelation?.economic_effect_id, correctionEffect?.economic_effect_id);

  const callerOverride = Object.assign({}, correctionCommand, {
    relationEconomicEffectId: "caller-controlled-override",
  });
  const overrideRetry = await correctCanonicalJournal(callerOverride, dependencies(state));
  assert.equal(overrideRetry.journalId, correction.journalId);
  assert.equal(correctionRelation?.economic_effect_id, correctionCommand.economicEffectId);
  assert.notEqual(correctionRelation?.economic_effect_id, "caller-controlled-override");

  const secondCorrection = await correctCanonicalJournal(
    {
      ...correctionCommand,
      economicEffectId: `sc-01-correction-distinct-${randomUUID()}`,
      idempotencyKey: `sc-01-correction-distinct-${randomUUID()}`,
    },
    dependencies(state),
  );
  assert.notEqual(secondCorrection.journalId, correction.journalId);

  const secondReversalCommand = {
    ...reversalCommand,
    economicEffectId: `sc-01-reversal-second-${randomUUID()}`,
    idempotencyKey: `sc-01-reversal-second-${randomUUID()}`,
  };
  await expectDatabaseCode(
    () => reverseCanonicalJournal(secondReversalCommand, dependencies(state)),
    "23505",
  );
  const [secondReversalEffect] = await db
    .select()
    .from(accountingPostingEffectsTable)
    .where(eq(accountingPostingEffectsTable.economic_effect_id, secondReversalCommand.economicEffectId));
  assert.equal(secondReversalEffect, undefined);

  await expectDatabaseCode(
    () =>
      pool.query(
        `INSERT INTO canonical_journal_relations
          (company_id, original_journal_id, related_journal_id, relation_type, reason, actor_type, actor_id, idempotency_key)
         VALUES ($1, $2, $3, 'correction', 'missing identity', 'user', $4, $5)`,
        [company.id, original.journalId, original.journalId, owner, `missing-${randomUUID()}`],
      ),
    "23502",
  );

  await expectDatabaseCode(
    () =>
      pool.query(
        `INSERT INTO canonical_journal_relations
          (company_id, economic_effect_id, original_journal_id, related_journal_id, relation_type, reason, actor_type, actor_id, idempotency_key)
         VALUES ($1, 'does-not-exist', $2, $3, 'correction', 'missing effect', 'user', $4, $5)`,
        [company.id, original.journalId, original.journalId, owner, `missing-effect-${randomUUID()}`],
      ),
    "23503",
  );

  await expectDatabaseCode(
    () =>
      pool.query(
        `INSERT INTO canonical_journal_relations
          (company_id, economic_effect_id, original_journal_id, related_journal_id, relation_type, reason, actor_type, actor_id, idempotency_key)
         VALUES ($1, $2, $3, $4, 'correction', 'company mismatch', 'user', $5, $6)`,
        [
          otherCompany.id,
          reversalEffect!.economic_effect_id,
          original.journalId,
          original.journalId,
          owner,
          `company-mismatch-${randomUUID()}`,
        ],
      ),
    "23503",
  );

  const atomicEffectIdentity = `sc-01-atomic-${randomUUID()}`;
  const atomicJournalId = randomUUID();
  const atomicLineIds = [randomUUID(), randomUUID()];
  await expectDatabaseCode(
    () => db.transaction(async (transaction) => {
      await transaction.insert(accountingPostingEffectsTable).values({
        company_id: company.id,
        source_type: "sc-01",
        source_id: atomicJournalId,
        posting_kind: "sc-01",
        economic_effect_id: atomicEffectIdentity,
        idempotency_key: `sc-01-atomic-key-${randomUUID()}`,
        command_fingerprint: "sc-01-atomic-fingerprint",
        status: "pending",
        created_by_type: "user",
        created_by_id: owner,
      });
      await transaction.insert(canonicalJournalEntriesTable).values({
        id: atomicJournalId,
        company_id: company.id,
        posting_date: "2026-04-13",
        financial_year_id: "sc-01-fy",
        accounting_period_id: "sc-01-period",
        configuration_version_id: "sc-01-config",
        currency_code: "GBP",
        description: "SC-01 atomic rollback fixture",
        source_type: "sc-01",
        source_id: atomicJournalId,
        posting_kind: "sc-01",
        economic_effect_id: atomicEffectIdentity,
        status: "posted",
        total_debit_minor: "500",
        total_credit_minor: "500",
        created_by_type: "user",
        created_by_id: owner,
      });
      await transaction.insert(canonicalJournalLinesTable).values([
        {
          id: atomicLineIds[0],
          journal_entry_id: atomicJournalId,
          company_id: company.id,
          line_number: 1,
          account_id: debit.id,
          debit_minor: "500",
          credit_minor: "0",
          currency_code: "GBP",
        },
        {
          id: atomicLineIds[1],
          journal_entry_id: atomicJournalId,
          company_id: company.id,
          line_number: 2,
          account_id: credit.id,
          debit_minor: "0",
          credit_minor: "500",
          currency_code: "GBP",
        },
      ]);
      await transaction.insert(canonicalJournalRelationsTable).values({
        company_id: company.id,
        economic_effect_id: "wrong-effect",
        original_journal_id: original.journalId,
        related_journal_id: atomicJournalId,
        relation_type: "correction",
        reason: "SC-01 forced rollback",
        actor_type: "user",
        actor_id: owner,
        idempotency_key: `sc-01-atomic-relation-${randomUUID()}`,
      });
    }),
    "23503",
  );

  const [rolledBackEffect] = await db
    .select()
    .from(accountingPostingEffectsTable)
    .where(eq(accountingPostingEffectsTable.economic_effect_id, atomicEffectIdentity));
  const [rolledBackJournal] = await db
    .select()
    .from(canonicalJournalEntriesTable)
    .where(eq(canonicalJournalEntriesTable.id, atomicJournalId));
  const rolledBackLines = await db
    .select()
    .from(canonicalJournalLinesTable)
    .where(eq(canonicalJournalLinesTable.journal_entry_id, atomicJournalId));
  const rolledBackRelations = await db
    .select()
    .from(canonicalJournalRelationsTable)
    .where(eq(canonicalJournalRelationsTable.related_journal_id, atomicJournalId));
  const rolledBackAudits = await db
    .select()
    .from(accountingAuditEventsTable)
    .where(eq(accountingAuditEventsTable.journal_id, atomicJournalId));
  assert.equal(rolledBackEffect, undefined);
  assert.equal(rolledBackJournal, undefined);
  assert.equal(rolledBackLines.length, 0);
  assert.equal(rolledBackRelations.length, 0);
  assert.equal(rolledBackAudits.length, 0);
});

test.after(async () => {
  await pool.end();
});
