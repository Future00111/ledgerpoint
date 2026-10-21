import test from "node:test";
import assert from "node:assert/strict";
import { InvokeLLM, UploadFile } from "./integrations.js";

test("LLM integration fails explicitly when no provider is configured", async () => {
  await assert.rejects(
    InvokeLLM({ prompt: "create a workflow" }),
    error => error.code === "LLM_PROVIDER_UNAVAILABLE",
  );
});

test("file upload fails explicitly when persistent storage is not configured", async () => {
  await assert.rejects(
    UploadFile({ file: new Blob(["synthetic"]) }),
    error => error.code === "FILE_STORAGE_UNAVAILABLE",
  );
});
