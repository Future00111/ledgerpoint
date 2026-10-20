// Pure scenario tests import the existing AI constructor but must never use a
// real key, HTTP provider, or a real DB. Invoke only in the sanitized test child.
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
if (isMainThread) process.chdir(fileURLToPath(new URL("../../../", import.meta.url)));
process.env.OPENAI_API_KEY = "w03-synthetic-invalid-not-a-secret";
globalThis.fetch = async () => { throw new Error("HTTP is disabled in W03 pure regressions"); };
