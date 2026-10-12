import assert from "node:assert/strict";
import { test } from "node:test";
import { pushSchemaToConvergence } from "./run-ledgerly-canonical-postgresql.mjs";

const known = `error: there is no unique constraint matching given keys for referenced table "accounting_posting_effects"\nseverity: 'ERROR',\ncode: '42830',`;
const clean = { stdout: "Schema converged", stderr: "" };
function fixture(attempts, indexError) {
  const calls = [];
  return {
    calls,
    push: async () => {
      calls.push("push");
      const value = attempts.shift();
      if (value instanceof Error) throw value;
      assert.ok(value, "Unexpected additional schema push");
      return value;
    },
    index: async () => { calls.push("index"); if (indexError) throw indexError; },
  };
}

test("a clean first push needs no prerequisite mutation or retry", async () => {
  const f = fixture([clean]);
  assert.deepEqual(await pushSchemaToConvergence(f.push, f.index), { recoveredOrdering: false, pushes: 1 });
  assert.deepEqual(f.calls, ["push"]);
});

for (const [label, first] of [
  ["zero-exit stdout", { stdout: known, stderr: "" }],
  ["zero-exit stderr", { stdout: "", stderr: known }],
  ["ANSI output", { stdout: `\x1b[31m${known}\x1b[0m`, stderr: "" }],
  ["nonzero exit with full captured stdout", Object.assign(new Error("docker exited with status 1"), { stdout: known, stderr: "" })],
]) {
  test(`the exact known ordering error in ${label} requires a clean second push`, async () => {
    const f = fixture([first, clean]);
    assert.deepEqual(await pushSchemaToConvergence(f.push, f.index), { recoveredOrdering: true, pushes: 2 });
    assert.deepEqual(f.calls, ["push", "index", "push"]);
  });
}

for (const [label, first] of [
  ["unknown zero-exit SQL error", { stdout: "error: permission denied for schema public", stderr: "" }],
  ["unknown nonzero error", new Error("Docker terminated unexpectedly")],
  ["other referenced table", { stdout: known.replace("accounting_posting_effects", "other_table"), stderr: "" }],
  ["unexpected SQLSTATE", { stdout: known.replace("42830", "42501"), stderr: "" }],
  ["mixed known and unknown errors", { stdout: known, stderr: "Error: connection refused" }],
  ["fatal severity", { stdout: known.replace("'ERROR'", "'FATAL'"), stderr: "" }],
  ["zero-exit severity-only error", { stdout: "severity: 'ERROR', code: '42501'", stderr: "" }],
]) {
  test(`${label} fails closed without prerequisite mutation`, async () => {
    const f = fixture([first]);
    await assert.rejects(pushSchemaToConvergence(f.push, f.index), /outside the approved/);
    assert.deepEqual(f.calls, ["push"]);
  });
}

for (const [label, second] of [
  ["known zero-exit error persists", { stdout: known, stderr: "" }],
  ["unknown zero-exit error", { stdout: "Error: schema remains incomplete", stderr: "" }],
  ["second push throws", new Error("push failed")],
]) {
  test(`${label} cannot be accepted as converged`, async () => {
    const f = fixture([{ stdout: known, stderr: "" }, second]);
    await assert.rejects(pushSchemaToConvergence(f.push, f.index), /did not converge/);
    assert.deepEqual(f.calls, ["push", "index", "push"]);
  });
}

test("a failed prerequisite stops before the second push", async () => {
  const f = fixture([{ stdout: known, stderr: "" }], new Error("index creation failed"));
  await assert.rejects(pushSchemaToConvergence(f.push, f.index), /index creation failed/);
  assert.deepEqual(f.calls, ["push", "index"]);
});
