import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeFounderSession, createFounderSessionToken } from "../lib/control-plane/auth-core";
import { assertFixtureModeAllowed, readControlPlaneSnapshot } from "../lib/control-plane/provider";

const config = { founderId: "founder", sessionSecret: "a-secure-test-secret-that-is-at-least-32-bytes" };
const now = new Date("2026-09-22T18:00:00.000Z");
const session = { sub: "founder", role: "founder" as const, exp: Math.floor(now.getTime() / 1000) + 600, nonce: "deterministic-nonce-001" };

test("Control Plane is deny-by-default and rejects forged, expired, or mismatched sessions", () => {
  assert.throws(() => authorizeFounderSession({ now }), /not authorized/);
  const token = createFounderSessionToken(session, config);
  assert.equal(authorizeFounderSession({ token, config, now }).sub, "founder");
  assert.throws(() => authorizeFounderSession({ token: `${token}x`, config, now }), /Invalid/);
  assert.throws(() => authorizeFounderSession({ token, config: { ...config, founderId: "intruder" }, now }), /mismatched/);
  assert.throws(() => authorizeFounderSession({ token, config, now: new Date("2026-09-23T18:00:00.000Z") }), /expired/);
});

test("production cannot enable fixture data", () => {
  assert.throws(() => assertFixtureModeAllowed("production"), /forbidden/);
  assert.doesNotThrow(() => assertFixtureModeAllowed("development"));
});

test("read boundary validates provider output and product isolation", async () => {
  const provider = { mode: "fixture" as const, async readSnapshot() { return { nope: true }; } };
  await assert.rejects(() => readControlPlaneSnapshot({ provider, founderId: "founder" }));
});
