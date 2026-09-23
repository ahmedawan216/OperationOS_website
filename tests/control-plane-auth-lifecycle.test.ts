import assert from "node:assert/strict";
import { test } from "node:test";
import { assertTrustedControlPlaneOrigin, authenticateFounderAndCreateSession, authorizeFounderSession, founderSessionCookieOptions } from "../lib/control-plane/auth-core";

const config = { founderId: "founder", sessionSecret: "a-secure-test-secret-that-is-at-least-32-bytes" };
const now = new Date("2026-09-23T10:00:00.000Z");

test("verified founder credentials issue the existing bounded HMAC session", async () => {
  const result = await authenticateFounderAndCreateSession({
    password: "correct-password",
    verifier: { async verifyPassword(password) { return password === "correct-password"; } },
    config,
    now,
    nonce: "production-login-nonce-001",
  });
  const session = authorizeFounderSession({ token: result.token, config, now });
  assert.equal(session.sub, "founder");
  assert.equal(session.role, "founder");
  assert.equal(result.expiresAt.toISOString(), "2026-09-23T18:00:00.000Z");
});

test("invalid credentials and identity-provider failures do not issue sessions", async () => {
  await assert.rejects(() => authenticateFounderAndCreateSession({ password: "wrong-password", verifier: { async verifyPassword() { return false; } }, config, now, nonce: "production-login-nonce-002" }), /invalid/);
  await assert.rejects(() => authenticateFounderAndCreateSession({ password: "correct-password", verifier: { async verifyPassword() { throw new Error("private provider detail"); } }, config, now, nonce: "production-login-nonce-003" }), /unavailable/);
});

test("production founder cookie is HTTP-only, strict, secure, and bounded", () => {
  assert.deepEqual(founderSessionCookieOptions(true), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 28_800, priority: "high" });
});

test("login and logout mutations require the exact trusted origin", () => {
  assert.doesNotThrow(() => assertTrustedControlPlaneOrigin({ requestUrl: "https://control.operationos.org/api/control-plane/auth/login", origin: "https://control.operationos.org" }));
  assert.throws(() => assertTrustedControlPlaneOrigin({ requestUrl: "https://control.operationos.org/api/control-plane/auth/login", origin: "https://evil.example" }), /Untrusted/);
  assert.throws(() => assertTrustedControlPlaneOrigin({ requestUrl: "https://control.operationos.org/api/control-plane/auth/login", origin: null }), /Untrusted/);
});
