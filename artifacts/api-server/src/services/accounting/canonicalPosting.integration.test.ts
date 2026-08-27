import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, sql } from "drizzle-orm";
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
  barrier?: ConcurrencyBarrier;
}

interface ConcurrencyArrival {
  backendPid: number;
  transactionId: string;
  arrivedAt: number;
}

class ConcurrencyBarrier {
  private readonly arrivals: ConcurrencyArrival[] = [];
  private readonly allArrived: Promise<void>;
  private resolveAllArrived!: () => void;
  private releasedAt: number | null = null;

  constructor(
    private readonly expected: number,
    private readonly timeoutMs = 10_000,
  ) {
    this.allArrived = new Promise((resolve) => {
      this.resolveAllArrived = resolve;
    });
  }

  private async waitWithTimeout(): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.allArrived,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`concurrency barrier timed out after ${this.timeoutMs}ms`)),
            this.timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async wait(transaction: unknown): Promise<void> {
    const result = await (
      transaction as {
        execute(query: unknown): Promise<{
          rows: Array<{ backendPid: number; transactionId: string }>;
        }>;
      }
    ).execute(
      sql`SELECT pg_backend_pid() AS "backendPid", txid_current()::text AS "transactionId"`,
    );
    const identity = result.rows[0];
    assert.ok(identity);
    this.arrivals.push({ ...identity, arrivedAt: Date.now() });
    if (this.arrivals.length === this.expected) {
      this.releasedAt = Date.now();
      this.resolveAllArrived();
    }
    await this.waitWithTimeout();
    assert.equal(this.arrivals.length, this.expected);
  }

  evidence(): {
    expected: number;
    arrivals: readonly ConcurrencyArrival[];
    releasedAt: number | null;
    overlapProven: boolean;
  } {
    return {
      expected: this.expected,
      arrivals: this.arrivals,
      releasedAt: this.releasedAt,
      overlapProven:
        this.arrivals.length === this.expected &&
        new Set(this.arrivals.map((arrival) => arrival.backendPid)).size === this.expected &&
        this.releasedAt !== null &&
        this.arrivals.every((arrival) => arrival.arrivedAt <= this.releasedAt!),
    };
  }
}

function dependencies(state: FixtureState): CanonicalPostingDependencies {
  return {
    sourceProvider: {
      async lockForPosting(command, transaction) {
        const authority = {
          companyId: state.companyId,
          sourceType: command.sourceType,
          sourceId: command.sourceId,
          status: "approved",
          isPostable: true,
          sourceRevision: state.revision,
          evidenceHash: `evidence-${state.revision}`,
        };
        return {
          authority,
          recordKeys: [`fixture-source:${command.sourceId}`],
          capturedToken: {
            companyId: state.companyId,
            revision: state.revision,
            evidenceHash: `evidence-${state.revision}`,
          },
          lockMode: "FOR UPDATE" as const,
          transactionBound: true as const,
          validateCurrent() {
            if (
              state.companyId !== authority.companyId ||
              state.revision !== authority.sourceRevision
            ) {
              return {
                ok: false as const,
                code: "source_stale" as const,
                message: "Fixture source authority changed after locking",
              };
            }
            return { ok: true as const };
          },
        };
      },
    },
    contextProvider: {
      async lockForPosting(input) {
        const authority = {
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
        return {
          authority,
          recordKeys: [
            `fixture-config:${state.configurationVersionId}`,
            "fixture-financial-year:FY-2026",
            "fixture-period:P-2026-04",
          ],
          capturedToken: {
            companyId: state.companyId,
            configurationVersionId: state.configurationVersionId,
            periodStatus: state.periodStatus,
          },
          lockMode: "FOR UPDATE" as const,
          transactionBound: true as const,
          validateCurrent() {
            if (
              state.companyId !== input.companyId ||
              state.configurationVersionId !== authority.configurationVersionId
            ) {
              return {
                ok: false as const,
                code: "stale_context" as const,
                message: "Fixture accounting context changed after locking",
              };
            }
            if (state.periodStatus !== "OPEN") {
              return {
                ok: false as const,
                code: "period_closed" as const,
                message: "Fixture accounting period closed after locking",
              };
            }
            return { ok: true as const };
          },
        };
      },
    },
    lineBuilder: {
      async build() {
        return state.lines;
      },
    },
    hooks: state.barrier
      ? {
          async afterTransactionStart(transaction) {
            await state.barrier!.wait(transaction);
          },
        }
      : undefined,
  };
}

function command(input: {
  companyId?: string;
  userId: string;
  effect: string;
  key: string;
  accountIds: string[];
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
    accountIds: input.accountIds,
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

test("canonical integration suite is bound to an empty API-role disposable database", async () => {
  const expectedDatabase = process.env.LEDGERLY_CANONICAL_TEST_DATABASE_NAME;
  const runId = process.env.LEDGERLY_CANONICAL_TEST_RUN_ID;
  const externalCi = process.env.LEDGERLY_CANONICAL_TEST_TARGET_CLASS ===
    "external-ci-postgresql-service-container";
  assert.match(expectedDatabase ?? "", /^ledgerly_canonical_test_[0-9a-f]{32}$/);
  assert.match(
    runId ?? "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(
    process.env.LEDGERLY_CANONICAL_TEST_ENVIRONMENT,
    externalCi ? "external-ci-disposable-test" : "development-disposable-test",
  );

  const identity = await pool.query<{
    databaseName: string;
    currentUser: string;
    sessionUser: string;
  }>(
    `SELECT
       current_database() AS "databaseName",
       current_user AS "currentUser",
       session_user AS "sessionUser"`,
  );
  assert.equal(identity.rows[0]?.databaseName, expectedDatabase);
  assert.equal(identity.rows[0]?.currentUser, "ledgerly_api");
  assert.equal(identity.rows[0]?.sessionUser, "ledgerly_api");
  assert.notEqual(identity.rows[0]?.databaseName, "heliumdb");

  const counts = await pool.query<{
    effects: string;
    journals: string;
    lines: string;
    relations: string;
    audits: string;
    legacyJournals: string;
  }>(
    `SELECT
       (SELECT count(*) FROM public.accounting_posting_effects)::text AS effects,
       (SELECT count(*) FROM public.canonical_journal_entries)::text AS journals,
       (SELECT count(*) FROM public.canonical_journal_lines)::text AS lines,
       (SELECT count(*) FROM public.canonical_journal_relations)::text AS relations,
       (SELECT count(*) FROM public.accounting_audit_events)::text AS audits,
       (SELECT count(*) FROM public.journal_entries)::text AS "legacyJournals"`,
  );
  assert.deepEqual(counts.rows[0], {
    effects: "0",
    journals: "0",
    lines: "0",
    relations: "0",
    audits: "0",
    legacyJournals: "0",
  });

  const triggers = await pool.query<{ triggerName: string; enabled: string }>(
    `SELECT t.tgname AS "triggerName", t.tgenabled AS enabled
     FROM pg_trigger t
     WHERE t.tgname = ANY($1::text[])
     ORDER BY t.tgname`,
    [[
      "ledgerly_accounting_audit_events_guard",
      "ledgerly_accounting_posting_effects_guard",
      "ledgerly_canonical_journal_entries_guard",
      "ledgerly_canonical_journal_lines_guard",
      "ledgerly_canonical_journal_relations_guard",
    ]],
  );
  assert.equal(triggers.rows.length, 5);
  assert.ok(triggers.rows.every((trigger) => trigger.enabled === "A"));

  if (externalCi) {
    async function expectPrivilegeDenied(query: string): Promise<void> {
      await assert.rejects(
        () => pool.query(query),
        (error: unknown) =>
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === "42501",
      );
    }

    await expectPrivilegeDenied("CREATE ROLE ledgerly_negative_probe");
    await expectPrivilegeDenied("SET ROLE postgres");
    await expectPrivilegeDenied(
      "ALTER TABLE public.canonical_journal_entries DISABLE TRIGGER ledgerly_canonical_journal_entries_guard",
    );
    await expectPrivilegeDenied("DROP TABLE public.canonical_journal_entries");
    console.log(
      "LEDGERLY_NEGATIVE_PRIVILEGE_EVIDENCE",
      JSON.stringify({
        roleEscalationDenied: true,
        setRolePostgresDenied: true,
        triggerDisableDenied: true,
        canonicalDeleteDenied: true,
      }),
    );
  }

  console.log(
    "LEDGERLY_DISPOSABLE_IDENTITY",
    JSON.stringify({
      runId,
      databaseName: identity.rows[0]?.databaseName,
      currentUser: identity.rows[0]?.currentUser,
      triggerState: "ENABLE ALWAYS",
      emptyCanonicalBaseline: true,
      externalCi,
    }),
  );
});

test("canonical posting persists a balanced immutable journal, audit, and retry-safe effect", async () => {
  const company = await createCompany("happy-path");
  const owner = `canonical-owner-${randomUUID()}`;
  const debit = await addAccount(company.id, "Fixture debit");
  const credit = await addAccount(company.id, "Fixture credit");
  await addMembership(company.id, owner, "owner");

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
    accountIds: state.accountIds,
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
    "identity_conflict",
  );
});

test("canonical posting fails closed for stale sources, closed periods, invalid accounts, and company mismatch", async () => {
  const companyA = await createCompany("failure-A");
  const companyB = await createCompany("failure-B");
  const ownerA = `canonical-owner-${randomUUID()}`;
  const debitA = await addAccount(companyA.id, "Fixture debit A");
  const creditA = await addAccount(companyA.id, "Fixture credit A");
  const accountB = await addAccount(companyB.id, "Fixture other company account");
  await addMembership(companyA.id, ownerA, "owner");

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
          accountIds: base.accountIds,
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
          accountIds: base.accountIds,
        }),
        dependencies({ ...base, periodStatus: "CLOSED" }),
      ),
    "period_closed",
  );
  await expectCode(
    () =>
      postCanonicalJournal(
        command({
          companyId: companyA.id,
          userId: ownerA,
          effect: `account-${randomUUID()}`,
          key: `account-${randomUUID()}`,
          accountIds: [accountB.id, creditA.id],
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
          accountIds: base.accountIds,
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

test("canonical posting is atomic under audit failure, concurrent retries, and additive reversal", async () => {
  const company = await createCompany("atomicity");
  const owner = `canonical-owner-${randomUUID()}`;
  const debit = await addAccount(company.id, "Fixture debit");
  const credit = await addAccount(company.id, "Fixture credit");
  await addMembership(company.id, owner, "accountant");

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
    accountIds: state.accountIds,
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
    accountIds: state.accountIds,
  });
  const barrier = new ConcurrencyBarrier(2);
  const concurrent = await Promise.all(
    Array.from({ length: 2 }, () =>
      postCanonicalJournal(concurrentCommand, dependencies({ ...state, barrier })),
    ),
  );
  const concurrencyEvidence = barrier.evidence();
  assert.equal(concurrencyEvidence.overlapProven, true);
  assert.equal(new Set(concurrencyEvidence.arrivals.map((arrival) => arrival.backendPid)).size, 2);
  console.log("LEDGERLY_CONCURRENCY_EVIDENCE", JSON.stringify(concurrencyEvidence));
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

test("SC-01 enforces company-scoped relation identity, uniqueness, and atomic rollback", async () => {
  const company = await createCompany("sc-01");
  const otherCompany = await createCompany("sc-01-other");
  const owner = `canonical-owner-${randomUUID()}`;
  const debit = await addAccount(company.id, "SC-01 debit");
  const credit = await addAccount(company.id, "SC-01 credit");
  await addMembership(company.id, owner, "owner");

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
    accountIds: state.accountIds,
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
  await expectCode(
    () => reverseCanonicalJournal(secondReversalCommand, dependencies(state)),
    "identity_conflict",
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
