import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalRecord } from "../lib/agent-runtime/canonical-record";

test("PostgreSQL jsonb object key ordering does not change authoritative identity", () => {
  const written = { product: { productKey: "operationos", versionId: "v1" },
    evidence: [{ id: "source", kind: "runtime" }] };
  const read = { evidence: [{ kind: "runtime", id: "source" }],
    product: { versionId: "v1", productKey: "operationos" } };
  assert.equal(canonicalRecord(written), canonicalRecord(read));
  assert.notEqual(canonicalRecord(written), canonicalRecord({ ...read, evidence: [] }));
  assert.notEqual(canonicalRecord([1, 2]), canonicalRecord([2, 1]));
});
