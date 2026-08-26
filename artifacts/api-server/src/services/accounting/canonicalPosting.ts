import { createHash } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  accountingAuditEventsTable,
  accountingPostingEffectsTable,
  canonicalJournalEntriesTable,
  canonicalJournalLinesTable,
  canonicalJournalRelationsTable,
  chartOfAccountsTable,
  companyUsersTable,
  companiesTable,
  type AccountingPostingEffect,
  type CanonicalJournalEntry,
  type CanonicalJournalLine,
} from "@workspace/db/schema";
import {
  resolveActiveMembership,
  type ActiveCompanyMembership,
} from "../../middlewares/companyScope.js";

export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AccountingCapability =
  | "accounting.post"
  | "accounting.reverse"
  | "accounting.correct";

export type AccountingPrincipal =
  | {
      kind: "user";
      userId: string;
      requestedCompanyId?: unknown;
    }
  | {
      kind: "system";
      id: string;
      companyId: string;
      capabilities: AccountingCapability[];
    };

export interface CanonicalSourceSnapshot {
  companyId: string;
  sourceType: string;
  sourceId: string;
  status: string;
  isPostable: boolean;
  sourceRevision?: string | null;
  evidenceHash?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PostingAccountContext {
  id: string;
  companyId: string;
  isActive: boolean;
  isEligible: boolean;
  currencyCode?: string | null;
}

export interface PostingContext {
  companyId: string;
  financialYearId: string;
  accountingPeriodId: string;
  periodStatus: "OPEN" | "CLOSED";
  configurationVersionId: string;
  currencyCode: string;
  accounts: Record<string, PostingAccountContext>;
  metadata?: Record<string, unknown>;
}

export interface CanonicalLineDraft {
  accountId: string;
  debitMinor: number | string;
  creditMinor: number | string;
  currencyCode?: string;
  taxCode?: string | null;
  sourceLineRef?: string | null;
  description?: string | null;
}

export interface CanonicalPostingCommand {
  principal: AccountingPrincipal;
  requestedCompanyId?: unknown;
  sourceType: string;
  sourceId: string;
  sourceRevision?: string | null;
  sourceEvidenceHash?: string | null;
  sourceStatus?: string | null;
  postingKind: string;
  economicEffectId: string;
  idempotencyKey: string;
  accountIds?: readonly string[];
  postingDate: string;
  configurationVersionId?: string | null;
  currencyCode: string;
  description: string;
  reference?: string | null;
}

export type AuthorityToken = Readonly<
  Record<string, string | boolean | null | undefined>
>;

export type AuthorityValidation =
  | { ok: true }
  | {
      ok: false;
      code: CanonicalPostingErrorCode;
      message: string;
    };

export interface LockedAuthority<T> {
  authority: T;
  recordKeys: readonly string[];
  capturedToken: AuthorityToken;
  lockMode: "FOR UPDATE";
  transactionBound: true;
  validateCurrent(input: {
    command: CanonicalPostingCommand;
    companyId: string;
    source?: CanonicalSourceSnapshot;
    context?: PostingContext;
  }): AuthorityValidation;
}

export interface TransactionalAuthorityProvider<Input, Locked> {
  lockForPosting(
    input: Input,
    transaction: DatabaseTransaction,
  ): Promise<LockedAuthority<Locked>>;
}

export interface CanonicalPostingDependencies {
  sourceProvider: TransactionalAuthorityProvider<
    CanonicalPostingCommand,
    CanonicalSourceSnapshot
  >;
  contextProvider: TransactionalAuthorityProvider<
    {
      companyId: string;
      postingDate: string;
      source: CanonicalSourceSnapshot;
      command: CanonicalPostingCommand;
      accountIds: readonly string[];
    },
    PostingContext
  >;
  lineBuilder: {
    build(input: {
      command: CanonicalPostingCommand;
      source: CanonicalSourceSnapshot;
      context: PostingContext;
    }): Promise<CanonicalLineDraft[]>;
  };
  hooks?: {
    afterTransactionStart?: (transaction: DatabaseTransaction) => Promise<void>;
    afterJournalInsert?: (input: {
      journal: CanonicalJournalEntry;
      lines: CanonicalJournalLine[];
    }) => Promise<void>;
    beforeAuditInsert?: () => Promise<void>;
  };
}

export interface CanonicalPostingResult {
  status: "posted" | "duplicate";
  journalId: string;
  effectId: string;
  idempotencyKey: string;
  totalDebitMinor: string;
  totalCreditMinor: string;
}

export interface CanonicalReversalCommand {
  principal: AccountingPrincipal;
  requestedCompanyId?: unknown;
  originalJournalId: string;
  reason: string;
  postingDate: string;
  postingKind?: string;
  economicEffectId: string;
  idempotencyKey: string;
  configurationVersionId?: string | null;
  reference?: string | null;
}

export interface CanonicalCorrectionCommand extends CanonicalReversalCommand {
  replacementDescription?: string;
}

export class CanonicalPostingError extends Error {
  constructor(
    public readonly code: CanonicalPostingErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "CanonicalPostingError";
  }
}

export type CanonicalPostingErrorCode =
  | "invalid_command"
  | "authorization_failed"
  | "authorization_conflict"
  | "company_scope_conflict"
  | "source_not_postable"
  | "source_stale"
  | "source_identity_missing"
  | "retry_required"
  | "stale_context"
  | "period_closed"
  | "context_invalid"
  | "account_invalid"
  | "journal_invalid"
  | "duplicate_conflict"
  | "identity_conflict"
  | "missing_authority"
  | "transaction_contract_invalid"
  | "lock_timeout"
  | "deadlock"
  | "company_not_found"
  | "account_not_found"
  | "journal_not_found"
  | "journal_immutable"
  | "correction_invalid";

const ROLE_CAPABILITIES: Record<string, readonly AccountingCapability[]> = {
  owner: ["accounting.post", "accounting.reverse", "accounting.correct"],
  accountant: ["accounting.post", "accounting.reverse", "accounting.correct"],
};

function fail(code: CanonicalPostingErrorCode, message: string): never {
  throw new CanonicalPostingError(code, message);
}

function failRetryable(code: CanonicalPostingErrorCode, message: string): never {
  throw new CanonicalPostingError(code, message, true);
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "cause" in error
    ? databaseErrorCode((error as { cause?: unknown }).cause)
    : undefined;
}

function mapDatabaseError(error: unknown): unknown {
  const code = databaseErrorCode(error);
  if (code === "55P03") {
    return new CanonicalPostingError(
      "lock_timeout",
      "The accounting authority lock timed out; no posting was committed",
      true,
    );
  }
  if (code === "40P01") {
    return new CanonicalPostingError(
      "deadlock",
      "The accounting authority lock encountered a deadlock; no posting was committed",
      true,
    );
  }
  if (code === "23505") {
    return new CanonicalPostingError(
      "identity_conflict",
      "The accounting identity is already claimed by a conflicting command",
    );
  }
  return error;
}

function assertLockedAuthority<T>(
  authority: LockedAuthority<T>,
  label: string,
): T {
  if (
    !authority ||
    authority.transactionBound !== true ||
    authority.lockMode !== "FOR UPDATE" ||
    !Array.isArray(authority.recordKeys) ||
    authority.recordKeys.length === 0 ||
    typeof authority.validateCurrent !== "function"
  ) {
    fail(
      "transaction_contract_invalid",
      `${label} did not return a transaction-bound FOR UPDATE authority`,
    );
  }
  return authority.authority;
}

function validateLockedAuthority(
  authority: LockedAuthority<unknown>,
  input: {
    command: CanonicalPostingCommand;
    companyId: string;
    source?: CanonicalSourceSnapshot;
    context?: PostingContext;
  },
): void {
  const validation = authority.validateCurrent(input);
  if (!validation.ok) fail(validation.code, validation.message);
}

function requireResolvedCompanyId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    failRetryable(
      "missing_authority",
      "A server-resolved company authority is required before source locking",
    );
  }
  return value.trim();
}

async function setTransactionLockTimeout(
  transaction: DatabaseTransaction,
): Promise<void> {
  await transaction.execute(sql`SET LOCAL lock_timeout = '2000ms'`);
}

async function lockCompany(
  transaction: DatabaseTransaction,
  companyId: string,
): Promise<void> {
  const rows = await transaction
    .select({ id: companiesTable.id, status: companiesTable.status })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .for("update");
  if (rows.length !== 1) {
    fail("company_not_found", "The authoritative company row was not found");
  }
  if (rows[0]?.status && rows[0].status !== "active") {
    fail("company_scope_conflict", "The authoritative company is not active");
  }
}

async function lockMembership(
  transaction: DatabaseTransaction,
  principal: AccountingPrincipal,
  companyId: string,
  capability: AccountingCapability,
): Promise<ActiveCompanyMembership | null> {
  if (principal.kind === "system") {
    assertPrincipalCapability(principal, capability, companyId);
    return null;
  }
  const rows = await transaction
    .select({
      id: companyUsersTable.id,
      company_id: companyUsersTable.company_id,
      user_id: companyUsersTable.user_id,
      role: companyUsersTable.role,
      is_active: companyUsersTable.is_active,
    })
    .from(companyUsersTable)
    .where(
      and(
        eq(companyUsersTable.user_id, principal.userId),
        eq(companyUsersTable.company_id, companyId),
      ),
    )
    .orderBy(companyUsersTable.id)
    .for("update");
  const activeMemberships = rows
    .filter((row) => row.is_active === true)
    .map(({ company_id, user_id, role, is_active }) => ({
      company_id,
      user_id,
      role,
      is_active,
    }));
  const membership = resolveActiveMembership(
    activeMemberships as ActiveCompanyMembership[],
  );
  if (!membership) {
    fail(
      rows.length === 0 ? "authorization_failed" : "authorization_conflict",
      "The locked membership state does not authorise this operation",
    );
  }
  if (!(ROLE_CAPABILITIES[membership.role ?? ""] ?? []).includes(capability)) {
    fail("authorization_failed", "The principal lacks the required accounting capability");
  }
  return membership;
}

interface LockedAccountRow {
  id: string;
  company_id: string;
  is_active: boolean | null;
}

async function lockAccountRows(
  transaction: DatabaseTransaction,
  companyId: string,
  accountIds: readonly string[],
): Promise<LockedAccountRow[]> {
  const uniqueIds = [...new Set(accountIds)].sort();
  if (uniqueIds.length === 0) {
    failRetryable(
      "missing_authority",
      "Every canonical posting must declare its resolved account identities",
    );
  }
  const rows = await transaction
    .select({
      id: chartOfAccountsTable.id,
      company_id: chartOfAccountsTable.company_id,
      is_active: chartOfAccountsTable.is_active,
    })
    .from(chartOfAccountsTable)
    .where(
      and(
        eq(chartOfAccountsTable.company_id, companyId),
        inArray(chartOfAccountsTable.id, uniqueIds),
      ),
    )
    .orderBy(chartOfAccountsTable.id)
    .for("update");
  if (rows.length !== uniqueIds.length) {
    fail("account_not_found", "An authoritative account row was not found");
  }
  return rows;
}

function validateLockedAccounts(
  rows: readonly LockedAccountRow[],
  context: PostingContext,
): void {
  for (const row of rows) {
    const account = context.accounts[row.id];
    if (
      !account ||
      account.companyId !== row.company_id ||
      !row.is_active ||
      !account.isActive ||
      !account.isEligible
    ) {
      fail("stale_context", `Account ${row.id} changed before posting`);
    }
  }
}

function requireNonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("invalid_command", `${label} is required`);
  }
  return value.trim();
}

function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail("invalid_command", "postingDate must be an ISO date");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    fail("invalid_command", "postingDate is invalid");
  }
  return value;
}

function minorUnits(value: number | string, label: string): string {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      fail("journal_invalid", `${label} must be a non-negative integer minor unit`);
    }
    return String(value);
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    fail("journal_invalid", `${label} must be a non-negative integer minor unit`);
  }
  return value;
}

function sourceToken(snapshot: CanonicalSourceSnapshot): "revision" | "hash" | null {
  if (snapshot.sourceRevision) return "revision";
  if (snapshot.evidenceHash) return "hash";
  return null;
}

function compareSourceFreshness(
  command: CanonicalPostingCommand,
  snapshot: CanonicalSourceSnapshot,
): void {
  if (!snapshot.sourceType || !snapshot.sourceId || !sourceToken(snapshot)) {
    fail("source_identity_missing", "A stable source revision or evidence hash is required");
  }
  if (!snapshot.isPostable) {
    fail("source_not_postable", "The source is not currently eligible for posting");
  }
  if (command.sourceStatus && snapshot.status !== command.sourceStatus) {
    fail("source_stale", "The source status changed before posting");
  }
  if (
    command.sourceRevision &&
    snapshot.sourceRevision !== command.sourceRevision
  ) {
    fail("source_stale", "The source revision changed before posting");
  }
  if (
    command.sourceEvidenceHash &&
    snapshot.evidenceHash !== command.sourceEvidenceHash
  ) {
    fail("source_stale", "The source evidence changed before posting");
  }
  if (
    !command.sourceRevision &&
    !command.sourceEvidenceHash
  ) {
    fail("source_identity_missing", "The command has no captured source revision or evidence hash");
  }
  if (
    command.sourceRevision &&
    snapshot.sourceRevision !== command.sourceRevision
  ) {
    fail("source_stale", "The captured source revision is stale");
  }
  if (
    command.sourceEvidenceHash &&
    snapshot.evidenceHash !== command.sourceEvidenceHash
  ) {
    fail("source_stale", "The captured source evidence hash is stale");
  }
}

function validateContext(
  command: CanonicalPostingCommand,
  source: CanonicalSourceSnapshot,
  context: PostingContext,
): void {
  if (
    !context.companyId ||
    context.companyId !== source.companyId ||
    context.companyId !== source.companyId
  ) {
    fail("context_invalid", "Posting context company does not match the source");
  }
  if (!context.financialYearId || !context.accountingPeriodId) {
    fail("context_invalid", "Financial year and accounting period are required");
  }
  if (!context.configurationVersionId) {
    fail("context_invalid", "A configuration version is required");
  }
  if (
    command.configurationVersionId &&
    command.configurationVersionId !== context.configurationVersionId
  ) {
    fail("context_invalid", "The accounting configuration changed before posting");
  }
  if (context.periodStatus !== "OPEN") {
    fail("period_closed", "The accounting period is closed");
  }
  if (context.currencyCode !== command.currencyCode) {
    fail("context_invalid", "Posting currency does not match the accounting context");
  }
}

function validateLines(
  drafts: CanonicalLineDraft[],
  command: CanonicalPostingCommand,
  context: PostingContext,
): {
  lines: Array<{
    accountId: string;
    debitMinor: string;
    creditMinor: string;
    currencyCode: string;
    taxCode: string | null;
    sourceLineRef: string | null;
    description: string | null;
  }>;
  totalDebitMinor: string;
  totalCreditMinor: string;
} {
  if (!Array.isArray(drafts) || drafts.length < 2) {
    fail("journal_invalid", "A posted journal requires at least two lines");
  }

  let debit = 0n;
  let credit = 0n;
  const lines = drafts.map((draft, index) => {
    const accountId = requireNonEmpty(draft.accountId, `line ${index + 1} accountId`);
    const account = context.accounts[accountId];
    if (
      !account ||
      account.companyId !== context.companyId
    ) {
      fail("account_invalid", `Account ${accountId} is not owned by the posting company`);
    }
    if (!account.isActive || !account.isEligible) {
      fail("account_invalid", `Account ${accountId} is not eligible for posting`);
    }

    const debitMinor = minorUnits(draft.debitMinor, `line ${index + 1} debitMinor`);
    const creditMinor = minorUnits(draft.creditMinor, `line ${index + 1} creditMinor`);
    if (debitMinor !== "0" && creditMinor !== "0") {
      fail("journal_invalid", `line ${index + 1} cannot contain both debit and credit`);
    }
    if (draft.currencyCode && draft.currencyCode !== command.currencyCode) {
      fail("journal_invalid", `line ${index + 1} currency does not match the journal`);
    }
    debit += BigInt(debitMinor);
    credit += BigInt(creditMinor);

    return {
      accountId,
      debitMinor,
      creditMinor,
      currencyCode: command.currencyCode,
      taxCode: draft.taxCode ?? null,
      sourceLineRef: draft.sourceLineRef ?? null,
      description: draft.description ?? null,
    };
  });

  if (debit === 0n || credit === 0n || debit !== credit) {
    fail("journal_invalid", "Journal debits and credits must balance to a positive total");
  }
  return {
    lines,
    totalDebitMinor: debit.toString(),
    totalCreditMinor: credit.toString(),
  };
}

function commandFingerprint(
  command: CanonicalPostingCommand,
  lines: ReturnType<typeof validateLines>["lines"],
  context: PostingContext,
): string {
  const payload = JSON.stringify({
    sourceType: command.sourceType,
    sourceId: command.sourceId,
    sourceRevision: command.sourceRevision ?? null,
    sourceEvidenceHash: command.sourceEvidenceHash ?? null,
    postingKind: command.postingKind,
    economicEffectId: command.economicEffectId,
    postingDate: command.postingDate,
    configurationVersionId: context.configurationVersionId,
    currencyCode: command.currencyCode,
    description: command.description,
    reference: command.reference ?? null,
    lines,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function actor(principal: AccountingPrincipal): { type: string; id: string } {
  return principal.kind === "user"
    ? { type: "user", id: principal.userId }
    : { type: "system", id: principal.id };
}

function assertPrincipalCapability(
  principal: AccountingPrincipal,
  capability: AccountingCapability,
  companyId: string,
): void {
  if (principal.kind === "system") {
    if (principal.companyId !== companyId || !principal.capabilities.includes(capability)) {
      fail("authorization_failed", "The system principal is not authorised for this company operation");
    }
    return;
  }
  if (!principal.userId) {
    fail("authorization_failed", "Authenticated user identity is required");
  }
}

async function findEffect(
  transaction: DatabaseTransaction,
  companyId: string,
  idempotencyKey: string,
  economicEffectId: string,
): Promise<AccountingPostingEffect | null> {
  const rows = await transaction
    .select()
    .from(accountingPostingEffectsTable)
    .where(
      and(
        eq(accountingPostingEffectsTable.company_id, companyId),
        or(
          eq(accountingPostingEffectsTable.idempotency_key, idempotencyKey),
          eq(accountingPostingEffectsTable.economic_effect_id, economicEffectId),
        ),
      ),
    )
    .orderBy(accountingPostingEffectsTable.id)
    .for("update");
  const byKey = rows.find((row) => row.idempotency_key === idempotencyKey);
  const byEffect = rows.find(
    (row) => row.economic_effect_id === economicEffectId,
  );
  if (byKey && byEffect && byKey.id !== byEffect.id) {
    fail("identity_conflict", "Idempotency and economic-effect identities conflict");
  }
  return byKey ?? byEffect ?? null;
}

function resultFromEffect(
  effect: AccountingPostingEffect,
  status: "posted" | "duplicate" = "duplicate",
): CanonicalPostingResult {
  if (effect.status === "pending") {
    failRetryable(
      "retry_required",
      "The matching posting effect is pending controlled resolution",
    );
  }
  if (effect.status === "uncertain") {
    failRetryable(
      "retry_required",
      "The matching posting effect has an uncertain outcome and cannot be replayed",
    );
  }
  if (!effect.journal_id || !effect.result) {
    fail("identity_conflict", "The existing effect has no completed canonical result");
  }
  const totalDebitMinor = String(effect.result.totalDebitMinor ?? "");
  const totalCreditMinor = String(effect.result.totalCreditMinor ?? "");
  if (!totalDebitMinor || !totalCreditMinor) {
    fail("identity_conflict", "The existing effect result is incomplete");
  }
  return {
    status,
    journalId: effect.journal_id,
    effectId: effect.id,
    idempotencyKey: effect.idempotency_key,
    totalDebitMinor,
    totalCreditMinor,
  };
}

function assertRetryIdentity(
  effect: AccountingPostingEffect,
  command: CanonicalPostingCommand,
  fingerprint: string,
): void {
  if (
    effect.idempotency_key !== command.idempotencyKey ||
    effect.economic_effect_id !== command.economicEffectId ||
    effect.command_fingerprint !== fingerprint
  ) {
    fail("identity_conflict", "The posting identity was reused for a different command");
  }
}

async function insertEffect(
  transaction: DatabaseTransaction,
  input: {
    companyId: string;
    command: CanonicalPostingCommand;
    fingerprint: string;
    actor: { type: string; id: string };
  },
): Promise<AccountingPostingEffect> {
  const inserted = await transaction
    .insert(accountingPostingEffectsTable)
    .values({
      company_id: input.companyId,
      source_type: input.command.sourceType,
      source_id: input.command.sourceId,
      posting_kind: input.command.postingKind,
      economic_effect_id: input.command.economicEffectId,
      idempotency_key: input.command.idempotencyKey,
      command_fingerprint: input.fingerprint,
      source_revision: input.command.sourceRevision ?? null,
      source_evidence_hash: input.command.sourceEvidenceHash ?? null,
      status: "pending",
      created_by_type: input.actor.type,
      created_by_id: input.actor.id,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  const existing = await findEffect(
    transaction,
    input.companyId,
    input.command.idempotencyKey,
    input.command.economicEffectId,
  );
  if (!existing) {
    fail("identity_conflict", "The effect identity could not be resolved after a conflict");
  }
  assertRetryIdentity(existing, input.command, input.fingerprint);
  if (existing.status !== "posted") {
    failRetryable(
      "retry_required",
      "The existing effect requires controlled recovery before replay",
    );
  }
  return existing;
}

async function persistJournal(
  transaction: DatabaseTransaction,
  input: {
    companyId: string;
    command: CanonicalPostingCommand;
    source: CanonicalSourceSnapshot;
    context: PostingContext;
    lines: ReturnType<typeof validateLines>["lines"];
    totals: { totalDebitMinor: string; totalCreditMinor: string };
    effect: AccountingPostingEffect;
    actor: { type: string; id: string };
    correction?: {
      originalJournalId: string;
      relationType: "reversal" | "correction";
      reason: string;
    };
    hooks?: CanonicalPostingDependencies["hooks"];
  },
): Promise<CanonicalPostingResult> {
  const [journal] = await transaction
    .insert(canonicalJournalEntriesTable)
    .values({
      company_id: input.companyId,
      posting_date: input.command.postingDate,
      financial_year_id: input.context.financialYearId,
      accounting_period_id: input.context.accountingPeriodId,
      configuration_version_id: input.context.configurationVersionId,
      currency_code: input.command.currencyCode,
      description: input.command.description,
      reference: input.command.reference ?? null,
      source_type: input.command.sourceType,
      source_id: input.command.sourceId,
      source_revision: input.source.sourceRevision ?? null,
      source_evidence_hash: input.source.evidenceHash ?? null,
      posting_kind: input.command.postingKind,
      economic_effect_id: input.command.economicEffectId,
      status: "posted",
      total_debit_minor: input.totals.totalDebitMinor,
      total_credit_minor: input.totals.totalCreditMinor,
      created_by_type: input.actor.type,
      created_by_id: input.actor.id,
      reversal_of_id: input.correction?.originalJournalId ?? null,
      correction_reason: input.correction?.reason ?? null,
    })
    .returning();
  if (!journal) fail("journal_invalid", "Canonical journal header was not created");

  const lines = await transaction
    .insert(canonicalJournalLinesTable)
    .values(
      input.lines.map((line, index) => ({
        journal_entry_id: journal.id,
        company_id: input.companyId,
        line_number: index + 1,
        account_id: line.accountId,
        debit_minor: line.debitMinor,
        credit_minor: line.creditMinor,
        currency_code: line.currencyCode,
        tax_code: line.taxCode,
        source_line_ref: line.sourceLineRef,
        description: line.description,
      })),
    )
    .returning();

  await input.hooks?.afterJournalInsert?.({ journal, lines });

  if (input.correction) {
    await transaction.insert(canonicalJournalRelationsTable).values({
      company_id: input.companyId,
      economic_effect_id: input.effect.economic_effect_id,
      original_journal_id: input.correction.originalJournalId,
      related_journal_id: journal.id,
      relation_type: input.correction.relationType,
      reason: input.correction.reason,
      actor_type: input.actor.type,
      actor_id: input.actor.id,
      idempotency_key: input.command.idempotencyKey,
    });
  }

  await input.hooks?.beforeAuditInsert?.();
  await transaction.insert(accountingAuditEventsTable).values({
    company_id: input.companyId,
    action: input.correction?.relationType ?? "post",
    outcome: "posted",
    target_type: "canonical_journal",
    target_id: journal.id,
    journal_id: journal.id,
    posting_effect_id: input.effect.id,
    source_type: input.command.sourceType,
    source_id: input.command.sourceId,
    actor_type: input.actor.type,
    actor_id: input.actor.id,
    capability:
      input.correction?.relationType === "reversal"
        ? "accounting.reverse"
        : input.correction?.relationType === "correction"
          ? "accounting.correct"
          : "accounting.post",
    reason: input.correction?.reason ?? null,
    context: {
      sourceRevision: input.source.sourceRevision ?? null,
      sourceEvidenceHash: input.source.evidenceHash ?? null,
      financialYearId: input.context.financialYearId,
      accountingPeriodId: input.context.accountingPeriodId,
      configurationVersionId: input.context.configurationVersionId,
      economicEffectId: input.command.economicEffectId,
      idempotencyKey: input.command.idempotencyKey,
    },
  });

  const result = {
    journalId: journal.id,
    totalDebitMinor: input.totals.totalDebitMinor,
    totalCreditMinor: input.totals.totalCreditMinor,
  };
  await transaction
    .update(accountingPostingEffectsTable)
    .set({
      status: "posted",
      journal_id: journal.id,
      result,
      updated_at: new Date(),
    })
    .where(eq(accountingPostingEffectsTable.id, input.effect.id));

  return {
    status: "posted",
    journalId: journal.id,
    effectId: input.effect.id,
    idempotencyKey: input.command.idempotencyKey,
    totalDebitMinor: input.totals.totalDebitMinor,
    totalCreditMinor: input.totals.totalCreditMinor,
  };
}

async function runCanonicalTransaction<T>(
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.transaction(async (transaction) => {
        await setTransactionLockTimeout(transaction);
        return operation(transaction);
      });
    } catch (error) {
      const mapped = mapDatabaseError(error);
      const retryableLockFailure =
        mapped instanceof CanonicalPostingError &&
        (mapped.code === "lock_timeout" || mapped.code === "deadlock");
      if (!retryableLockFailure || attempt === 3) throw mapped;
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
    }
  }
  failRetryable("retry_required", "The accounting command exhausted its retry budget");
}

function validateCommand(command: CanonicalPostingCommand): void {
  requireNonEmpty(command.sourceType, "sourceType");
  requireNonEmpty(command.sourceId, "sourceId");
  requireNonEmpty(command.postingKind, "postingKind");
  requireNonEmpty(command.economicEffectId, "economicEffectId");
  requireNonEmpty(command.idempotencyKey, "idempotencyKey");
  requireNonEmpty(command.currencyCode, "currencyCode");
  requireNonEmpty(command.description, "description");
  validateDate(command.postingDate);
}

function commandAccountIds(command: CanonicalPostingCommand): string[] {
  const accountIds = [...new Set(command.accountIds ?? [])].sort();
  if (accountIds.length === 0) {
    failRetryable(
      "missing_authority",
      "The command envelope does not contain resolved account identities",
    );
  }
  return accountIds;
}

function assertLineAccountsLocked(
  lines: readonly { accountId: string }[],
  accountIds: readonly string[],
): void {
  const locked = new Set(accountIds);
  if (lines.some((line) => !locked.has(line.accountId))) {
    fail(
      "stale_context",
      "The line builder returned an account outside the locked command envelope",
    );
  }
}

function sourceFromOriginal(original: CanonicalJournalEntry): CanonicalSourceSnapshot {
  return {
    companyId: original.company_id,
    sourceType: "canonical_journal",
    sourceId: original.id,
    status: "posted",
    isPostable: true,
    sourceRevision: original.source_revision ?? original.id,
    evidenceHash: original.source_evidence_hash,
  };
}

function reversalLines(lines: CanonicalJournalLine[]): CanonicalLineDraft[] {
  return lines.map((line) => ({
    accountId: line.account_id,
    debitMinor: line.credit_minor,
    creditMinor: line.debit_minor,
    currencyCode: line.currency_code,
    taxCode: line.tax_code,
    sourceLineRef: line.source_line_ref,
    description: line.description,
  }));
}

export async function postCanonicalJournal(
  command: CanonicalPostingCommand,
  dependencies: CanonicalPostingDependencies,
): Promise<CanonicalPostingResult> {
  validateCommand(command);
  const companyId = requireResolvedCompanyId(
    command.requestedCompanyId ??
      (command.principal.kind === "system"
        ? command.principal.companyId
        : command.principal.requestedCompanyId),
  );
  const accountIds = commandAccountIds(command);

  return runCanonicalTransaction(async (transaction) => {
    await dependencies.hooks?.afterTransactionStart?.(transaction);
    await lockCompany(transaction, companyId);
    const sourceAuthority = await dependencies.sourceProvider.lockForPosting(
      command,
      transaction,
    );
    const source = assertLockedAuthority(sourceAuthority, "Source provider");
    if (
      source.companyId !== companyId ||
      source.sourceType !== command.sourceType ||
      source.sourceId !== command.sourceId
    ) {
      fail(
        source.companyId !== companyId
          ? "company_scope_conflict"
          : "source_identity_missing",
        "The locked source identity does not match the command envelope",
      );
    }
    compareSourceFreshness(command, source);
    await lockMembership(
      transaction,
      command.principal,
      companyId,
      "accounting.post",
    );
    const lockedAccounts = await lockAccountRows(
      transaction,
      companyId,
      accountIds,
    );
    const contextAuthority = await dependencies.contextProvider.lockForPosting(
      {
        companyId,
        postingDate: command.postingDate,
        source,
        command,
        accountIds,
      },
      transaction,
    );
    const context = assertLockedAuthority(contextAuthority, "Context provider");
    validateContext(command, source, context);
    validateLockedAccounts(lockedAccounts, context);
    const drafts = await dependencies.lineBuilder.build({ command, source, context });
    const validated = validateLines(drafts, command, context);
    assertLineAccountsLocked(validated.lines, accountIds);

    validateLockedAuthority(sourceAuthority, { command, companyId, source, context });
    validateLockedAuthority(contextAuthority, { command, companyId, source, context });

    const fingerprint = commandFingerprint(command, validated.lines, context);
    const existing = await findEffect(
      transaction,
      companyId,
      command.idempotencyKey,
      command.economicEffectId,
    );
    if (existing) {
      assertRetryIdentity(existing, command, fingerprint);
      return resultFromEffect(existing);
    }
    const effect = await insertEffect(transaction, {
      companyId,
      command,
      fingerprint,
      actor: actor(command.principal),
    });
    if (effect.status === "posted") return resultFromEffect(effect);
    return persistJournal(transaction, {
      companyId,
      command,
      source,
      context,
      lines: validated.lines,
      totals: validated,
      effect,
      actor: actor(command.principal),
      hooks: dependencies.hooks,
    });
  });
}

async function postLinkedJournal(
  command: CanonicalPostingCommand,
  dependencies: Pick<
    CanonicalPostingDependencies,
    "contextProvider" | "lineBuilder" | "hooks"
  >,
  relation: {
    originalJournalId: string;
    relationType: "reversal" | "correction";
    reason: string;
  },
  buildDrafts: (input: {
    source: CanonicalSourceSnapshot;
    context: PostingContext;
    originalLines: CanonicalJournalLine[];
  }) => Promise<CanonicalLineDraft[]> | CanonicalLineDraft[],
): Promise<CanonicalPostingResult> {
  validateCommand(command);
  return runCanonicalTransaction(async (transaction) => {
    await dependencies.hooks?.afterTransactionStart?.(transaction);
    const [preliminaryOriginal] = await transaction
      .select()
      .from(canonicalJournalEntriesTable)
      .where(eq(canonicalJournalEntriesTable.id, relation.originalJournalId))
      .limit(1);
    if (!preliminaryOriginal) {
      fail("journal_not_found", "The original canonical journal was not found");
    }
    const preliminaryLines = await transaction
      .select()
      .from(canonicalJournalLinesTable)
      .where(
        and(
          eq(
            canonicalJournalLinesTable.journal_entry_id,
            preliminaryOriginal.id,
          ),
          eq(
            canonicalJournalLinesTable.company_id,
            preliminaryOriginal.company_id,
          ),
        ),
      )
      .orderBy(canonicalJournalLinesTable.line_number);
    const companyId = preliminaryOriginal.company_id;
    const requested = requireResolvedCompanyId(
      command.requestedCompanyId ??
        (command.principal.kind === "system"
          ? command.principal.companyId
          : command.principal.requestedCompanyId),
    );
    if (requested !== companyId) {
      fail("company_scope_conflict", "The requested company does not own the original journal");
    }

    await lockCompany(transaction, companyId);
    await lockMembership(
      transaction,
      command.principal,
      companyId,
      relation.relationType === "reversal"
        ? "accounting.reverse"
        : "accounting.correct",
    );
    const accountIds = [...new Set(preliminaryLines.map((line) => line.account_id))].sort();
    const lockedAccounts = await lockAccountRows(
      transaction,
      companyId,
      accountIds,
    );
    command.accountIds = accountIds;
    command.currencyCode = preliminaryOriginal.currency_code;
    command.sourceRevision =
      preliminaryOriginal.source_revision ?? preliminaryOriginal.id;
    command.sourceEvidenceHash = preliminaryOriginal.source_evidence_hash;
    const preliminarySource = sourceFromOriginal(preliminaryOriginal);
    const contextAuthority = await dependencies.contextProvider.lockForPosting(
      {
        companyId,
        postingDate: command.postingDate,
        source: preliminarySource,
        command,
        accountIds,
      },
      transaction,
    );
    const context = assertLockedAuthority(contextAuthority, "Context provider");

    const [original] = await transaction
      .select()
      .from(canonicalJournalEntriesTable)
      .where(eq(canonicalJournalEntriesTable.id, relation.originalJournalId))
      .for("update");
    if (!original || original.company_id !== companyId) {
      fail("company_scope_conflict", "The original journal company changed before locking");
    }
    const originalLines = await transaction
      .select()
      .from(canonicalJournalLinesTable)
      .where(
        and(
          eq(canonicalJournalLinesTable.journal_entry_id, original.id),
          eq(canonicalJournalLinesTable.company_id, companyId),
        ),
      )
      .orderBy(canonicalJournalLinesTable.line_number);
    if (original.status !== "posted" || originalLines.length < 2) {
      fail("correction_invalid", "Only a complete posted journal can be corrected");
    }
    if (
      originalLines.length !== preliminaryLines.length ||
      originalLines.some(
        (line, index) =>
          line.id !== preliminaryLines[index]?.id ||
          line.account_id !== preliminaryLines[index]?.account_id,
      )
    ) {
      fail("correction_invalid", "The original journal changed before final locking");
    }
    const source = sourceFromOriginal(original);
    command.currencyCode = original.currency_code;
    command.sourceRevision = source.sourceRevision;
    command.sourceEvidenceHash = source.evidenceHash;
    validateContext(command, source, context);
    validateLockedAccounts(lockedAccounts, context);
    const drafts = await buildDrafts({ source, context, originalLines });
    const validated = validateLines(drafts, command, context);
    assertLineAccountsLocked(validated.lines, accountIds);
    validateLockedAuthority(contextAuthority, {
      command,
      companyId,
      source,
      context,
    });

    const fingerprint = commandFingerprint(command, validated.lines, context);
    const existing = await findEffect(
      transaction,
      companyId,
      command.idempotencyKey,
      command.economicEffectId,
    );
    if (existing) {
      assertRetryIdentity(existing, command, fingerprint);
      return resultFromEffect(existing);
    }
    if (relation.relationType === "reversal") {
      const existingReversals = await transaction
        .select({ id: canonicalJournalRelationsTable.id })
        .from(canonicalJournalRelationsTable)
        .where(
          and(
            eq(canonicalJournalRelationsTable.company_id, companyId),
            eq(canonicalJournalRelationsTable.original_journal_id, original.id),
            eq(canonicalJournalRelationsTable.relation_type, "reversal"),
          ),
        )
        .orderBy(canonicalJournalRelationsTable.id);
      if (existingReversals.length > 0) {
        fail("identity_conflict", "The original journal already has a reversal");
      }
    }
    const effect = await insertEffect(transaction, {
      companyId,
      command,
      fingerprint,
      actor: actor(command.principal),
    });
    if (effect.status === "posted") return resultFromEffect(effect);
    return persistJournal(transaction, {
      companyId,
      command,
      source,
      context,
      lines: validated.lines,
      totals: validated,
      effect,
      actor: actor(command.principal),
      correction: relation,
      hooks: dependencies.hooks,
    });
  });
}

export async function reverseCanonicalJournal(
  command: CanonicalReversalCommand,
  dependencies: Pick<CanonicalPostingDependencies, "contextProvider" | "hooks">,
): Promise<CanonicalPostingResult> {
  const reason = requireNonEmpty(command.reason, "reason");
  const originalJournalId = requireNonEmpty(
    command.originalJournalId,
    "originalJournalId",
  );
  const sourceCommand: CanonicalPostingCommand = {
    principal: command.principal,
    requestedCompanyId: command.requestedCompanyId,
    sourceType: "canonical_journal",
    sourceId: originalJournalId,
    sourceStatus: "posted",
    postingKind: command.postingKind ?? "journal_reversal",
    economicEffectId: command.economicEffectId,
    idempotencyKey: command.idempotencyKey,
    postingDate: command.postingDate,
    configurationVersionId: command.configurationVersionId,
    currencyCode: "GBP",
    description: `Reversal of ${originalJournalId}`,
    reference: command.reference ?? null,
  };
  return postLinkedJournal(
    sourceCommand,
    {
      ...dependencies,
      lineBuilder: {
        async build() {
          fail("correction_invalid", "The reversal line builder is internal");
        },
      },
    },
    { originalJournalId, relationType: "reversal", reason },
    ({ originalLines }) => reversalLines(originalLines),
  );
}

export async function correctCanonicalJournal(
  command: CanonicalCorrectionCommand,
  dependencies: Pick<
    CanonicalPostingDependencies,
    "contextProvider" | "lineBuilder" | "hooks"
  >,
): Promise<CanonicalPostingResult> {
  const reason = requireNonEmpty(command.reason, "reason");
  const originalJournalId = requireNonEmpty(
    command.originalJournalId,
    "originalJournalId",
  );
  const sourceCommand: CanonicalPostingCommand = {
    principal: command.principal,
    requestedCompanyId: command.requestedCompanyId,
    sourceType: "canonical_journal",
    sourceId: originalJournalId,
    sourceStatus: "posted",
    postingKind: command.postingKind ?? "journal_correction",
    economicEffectId: command.economicEffectId,
    idempotencyKey: command.idempotencyKey,
    postingDate: command.postingDate,
    configurationVersionId: command.configurationVersionId,
    currencyCode: "GBP",
    description:
      command.replacementDescription ?? `Correction of ${originalJournalId}`,
    reference: command.reference ?? null,
  };
  return postLinkedJournal(
    sourceCommand,
    dependencies,
    { originalJournalId, relationType: "correction", reason },
    ({ source, context }) =>
      dependencies.lineBuilder.build({
        command: sourceCommand,
        source,
        context,
      }),
  );
}

export async function recoverCanonicalPostingOutcome(input: {
  companyId: string;
  idempotencyKey: string;
  economicEffectId: string;
  commandFingerprint: string;
}): Promise<CanonicalPostingResult | null> {
  const companyId = requireNonEmpty(input.companyId, "companyId");
  const idempotencyKey = requireNonEmpty(input.idempotencyKey, "idempotencyKey");
  const economicEffectId = requireNonEmpty(
    input.economicEffectId,
    "economicEffectId",
  );
  const fingerprint = requireNonEmpty(
    input.commandFingerprint,
    "commandFingerprint",
  );
  return runCanonicalTransaction(async (transaction) => {
    await lockCompany(transaction, companyId);
    const effect = await findEffect(
      transaction,
      companyId,
      idempotencyKey,
      economicEffectId,
    );
    if (!effect) return null;
    if (effect.command_fingerprint !== fingerprint) {
      fail("identity_conflict", "The recovery identity has different command meaning");
    }
    return resultFromEffect(effect);
  });
}
