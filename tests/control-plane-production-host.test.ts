import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { controlPlanePath, controlPlaneRequestUrl, resolveControlPlaneHost } from "../lib/control-plane/host-routing";
import { askMetaAgent } from "../lib/control-plane/meta-agent";
import { GroundedMetaAgentProvider } from "../lib/control-plane/grounded-meta-agent-provider";
import { fixtureSnapshot } from "../lib/control-plane/testing/fixture-provider";

test("dedicated Control Plane host rewrites only recognized private routes", () => {
  const configuredHost = "control.operationos.org";
  assert.deepEqual(resolveControlPlaneHost({ hostname: configuredHost, pathname: "/", configuredHost }), { disposition: "rewrite", pathname: "/control", privateSurface: true });
  for (const section of ["products", "agents", "executions", "learnings", "improvements", "evaluations", "safety", "approvals", "versions", "health", "meta-agent", "login"]) {
    assert.deepEqual(resolveControlPlaneHost({ hostname: configuredHost, pathname: `/${section}`, configuredHost }), { disposition: "rewrite", pathname: `/control/${section}`, privateSurface: true });
    assert.deepEqual(resolveControlPlaneHost({ hostname: configuredHost, pathname: `/control/${section}`, configuredHost }), { disposition: "redirect", pathname: `/${section}`, privateSurface: true });
  }
  assert.deepEqual(resolveControlPlaneHost({ hostname: configuredHost, pathname: "/control", configuredHost }), { disposition: "redirect", pathname: "/", privateSurface: true });
  assert.deepEqual(resolveControlPlaneHost({ hostname: configuredHost, pathname: "/api/control-plane/auth/login", configuredHost }), { disposition: "next", privateSurface: true });
  assert.deepEqual(resolveControlPlaneHost({ hostname: configuredHost, pathname: "/brand/operationos-h1-horizontal-white.svg", configuredHost }), { disposition: "next", privateSurface: true });
  assert.deepEqual(resolveControlPlaneHost({ hostname: configuredHost, pathname: "/unrelated", configuredHost }), { disposition: "deny", privateSurface: true });
  assert.equal(controlPlanePath("/control", configuredHost, configuredHost), "/");
  assert.equal(controlPlanePath("/control/login", configuredHost, configuredHost), "/login");
  assert.equal(controlPlanePath("/control/login", "localhost", configuredHost), "/control/login");
  assert.equal(controlPlaneRequestUrl({ internalPathname: "/control/products", requestUrl: "http://localhost:3000/api/control-plane/governance", forwardedHost: "control.operationos.org", forwardedProto: "https", configuredHost }).toString(), "https://control.operationos.org/products");
});

test("primary site is unchanged while Control Plane paths fail closed off-host", () => {
  const configuredHost = "control.operationos.org";
  assert.deepEqual(resolveControlPlaneHost({ hostname: "operationos.org", pathname: "/pricing", configuredHost }), { disposition: "next", privateSurface: false });
  assert.deepEqual(resolveControlPlaneHost({ hostname: "operationos.org", pathname: "/control", configuredHost }), { disposition: "deny", privateSurface: true });
  assert.deepEqual(resolveControlPlaneHost({ hostname: "operationos.org", pathname: "/brand/operationos-h1-horizontal-white.svg", configuredHost }), { disposition: "next", privateSurface: false });
  assert.deepEqual(resolveControlPlaneHost({ hostname: "operationos.org", pathname: "/api/control-plane/governance", configuredHost }), { disposition: "deny", privateSurface: true });
});

test("local development remains explicit and protected by server authorization", () => {
  assert.deepEqual(resolveControlPlaneHost({ hostname: "localhost", pathname: "/control" }), { disposition: "next", privateSurface: true });
  assert.deepEqual(resolveControlPlaneHost({ hostname: "operationos.org", pathname: "/control", requireConfiguredHost: true }), { disposition: "deny", privateSurface: true });
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /private, no-store/);
  assert.match(middleware, /X-Robots-Tag/);
  assert.doesNotMatch(middleware, /CONTROL_PLANE_SESSION_SECRET|SUPABASE_SECRET_KEY/);
});

test("grounded Meta-Agent works on authoritative projections without fixture fallback", async () => {
  const snapshot = { ...fixtureSnapshot, sourceMode: "authoritative" as const };
  const answer = await askMetaAgent({ provider: new GroundedMetaAgentProvider(), snapshot, founderId: "founder", queryId: "prod-query", question: "What needs my approval?" });
  assert.equal(answer.readOnly, true);
  assert.equal(answer.approvalGranted, false);
  assert.equal(answer.claims[0]?.recordReferences[0]?.kind, "approval");
  const page = readFileSync(new URL("../app/control/(private)/[section]/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /sourceMode\s*===\s*["']fixture/);
});
