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
});

test.after(async () => {
  await pool.end();
});
