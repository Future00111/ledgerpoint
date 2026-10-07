// C3 identity validation only; this is not PostgreSQL or accounting qualification.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const identity = Object.freeze({
  repository: "Future00111/ledgerpoint",
  workflowRef: "Future00111/ledgerpoint/.github/workflows/ledgerly-tr01-c3-identity-status.yml@refs/heads/main",
  ref: "refs/heads/tr01/implementation-identity-successor-c3",
  sha: "1c26be19295902a38e1939b56ff99ae9a195d3de",
  parent: "e7f43c70e45c068971aeb241ce1b01a30bb01e37",
  tree: "beb56d35539d81636b609602b3c57d167bc88888",
  context: "tr01/c3-identity-validation",
});

export function assertTrustedInvocation(env) {
  if (
    env.GITHUB_REPOSITORY !== identity.repository ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_REF_PROTECTED !== "true" ||
    env.GITHUB_WORKFLOW_REF !== identity.workflowRef ||
    env.GITHUB_JOB !== "identity" ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    env.TR01_VALIDATION_RESULT !== "success" ||
    !/^[a-f0-9]{40}$/.test(env.TR01_C3_APPROVED_WORKFLOW_SHA ?? "") ||
    env.GITHUB_WORKFLOW_SHA !== env.TR01_C3_APPROVED_WORKFLOW_SHA ||
    env.GITHUB_SHA !== env.TR01_C3_APPROVED_WORKFLOW_SHA
  ) {
    throw new Error("Identity validation requires the approved C3 workflow SHA, successful dependency, and protected-main dispatch");
  }
}

export async function validateAndPublishIdentity(env, request) {
  assertTrustedInvocation(env);
  const branchPath = `/repos/${identity.repository}/git/ref/heads/${identity.ref.slice("refs/heads/".length)}`;
  const commitPath = `/repos/${identity.repository}/git/commits/${identity.sha}`;
  const branch = await request("GET", branchPath);
  if (
    branch?.ref !== identity.ref ||
    branch?.object?.type !== "commit" ||
    branch?.object?.sha !== identity.sha
  ) {
    throw new Error("Protected successor ref does not point to the pinned C3 identity");
  }
  const commit = await request("GET", commitPath);
  if (
    commit?.sha !== identity.sha ||
    commit?.tree?.sha !== identity.tree ||
    commit?.parents?.length !== 1 ||
    commit.parents[0]?.sha !== identity.parent
  ) {
    throw new Error("C3 commit parent or tree differs from the pinned review-package identity");
  }
  // Check the ref again so a changed tip cannot receive success based only on
  // the first read. Ruleset update restrictions remain essential.
  const confirmed = await request("GET", branchPath);
  if (
    confirmed?.ref !== identity.ref ||
    confirmed?.object?.type !== "commit" ||
    confirmed?.object?.sha !== identity.sha
  ) {
    throw new Error("Successor ref changed during identity validation");
  }
  const posted = await request("POST", `/repos/${identity.repository}/statuses/${identity.sha}`, {
    state: "success",
    context: identity.context,
    description: "C3 identity and non-DB checks; pinned review-package identity; NOT TI-03 qualification",
  });
  if (
    posted?.state !== "success" ||
    posted?.context !== identity.context
  ) {
    throw new Error("GitHub did not confirm the C3 validation status response");
  }
}

async function githubRequest(method, path, body) {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GitHub Actions token unavailable");
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok || (method === "POST" && response.status !== 201)) {
    throw new Error(`GitHub ${method} ${path} failed (HTTP ${response.status})`);
  }
  return response.json();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  validateAndPublishIdentity(process.env, githubRequest).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}