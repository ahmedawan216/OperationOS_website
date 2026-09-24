import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { authorizeFounderSession, createFounderSessionToken } from "../lib/control-plane/auth-core";

const root = fileURLToPath(new URL("../", import.meta.url));
const founderHost = "control.operationos.org";
const founderId = "founder-http-test";
const secret = "local-test-only-founder-session-secret-000001";

async function availablePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test port unavailable");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test("real HTTP POST reaches the founder proof route only on its host, with a valid session", { timeout: 60_000 }, async () => {
  const port = await availablePort();
  const token = createFounderSessionToken({ sub: founderId, role: "founder",
    exp: Math.floor(Date.now() / 1_000) + 3_600, nonce: "local-test-only-nonce-000001" },
  { founderId, sessionSecret: secret });
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env: { ...process.env, CONTROL_PLANE_HOST: founderHost,
      CONTROL_PLANE_ORIGIN: `https://${founderHost}`,
      CONTROL_PLANE_FOUNDER_ID: founderId, CONTROL_PLANE_SESSION_SECRET: secret,
      GROQ_API_KEY: "", OPERATIONOS_AGENT_PROVIDER: "groq", OPERATIONOS_AGENT_MODEL: "openai/gpt-oss-20b" },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}/api/control-plane/proof`;
  const request = (host: string, cookie?: string) => fetch(url, { method: "POST",
    headers: { host, "x-forwarded-host": host, origin: `https://${host}`,
      ...(cookie ? { cookie: `operationos_control_session=${cookie}` } : {}) },
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt++) {
      if (child.exitCode !== null) throw new Error("Local Next server exited before readiness");
      try {
        const response = await fetch(url, { headers: { host: founderHost, "x-forwarded-host": founderHost } });
        ready = response.status === 405;
      } catch { /* Server has not begun listening. */ }
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert.ok(ready, "Local founder route did not become reachable");

    const unauthenticated = await request(founderHost);
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(await unauthenticated.json(), { error: "Founder session required" });
    const authenticated = await request(founderHost, token);
    assert.equal(authenticated.status, 503);
    assert.deepEqual(await authenticated.json(), { error: "Controlled proof unavailable" });
    // The test has no model credential; a valid session reaches the handler but cannot register or execute.
    const publicHost = await request("operationos.org", token);
    assert.equal(publicHost.status, 404);
    assert.equal(await publicHost.text(), "");
  } finally {
    child.kill("SIGTERM");
  }
});

test("founder HTTP login issues a cookie accepted by the private page and proof route", { timeout: 90_000 }, async () => {
  const port = await availablePort();
  const identity = createHttpServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url?.startsWith("/auth/v1/token")) {
      response.end(JSON.stringify({ access_token: "test-access-token", refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600,
        user: { id: "test-user", email: "founder@example.test" } }));
    } else if (request.url === "/auth/v1/user") {
      response.end(JSON.stringify({ id: "test-user", email: "founder@example.test" }));
    } else { response.statusCode = 404; response.end("{}"); }
  });
  identity.listen(0, "127.0.0.1");
  await once(identity, "listening");
  const address = identity.address();
  if (!address || typeof address === "string") throw new Error("Identity test server unavailable");
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env: { ...process.env, CONTROL_PLANE_HOST: founderHost, CONTROL_PLANE_ORIGIN: `https://${founderHost}`,
      CONTROL_PLANE_FOUNDER_ID: founderId, CONTROL_PLANE_SESSION_SECRET: secret,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`, SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      CONTROL_PLANE_FOUNDER_EMAIL: "founder@example.test", GROQ_API_KEY: "" },
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}`;
  const headers = { host: founderHost, "x-forwarded-host": founderHost, origin: `https://${founderHost}` };
  try {
    let ready = false;
    for (let attempt = 0; attempt < 90 && !ready; attempt++) {
      if (child.exitCode !== null) throw new Error("Local Next server exited before readiness");
      try { ready = (await fetch(`${base}/api/control-plane/proof`, { headers })).status === 405; } catch { /* Starting. */ }
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert.ok(ready);
    const login = await fetch(`${base}/api/control-plane/auth/login`, { method: "POST", headers,
      body: new URLSearchParams({ password: "test-founder-password" }), redirect: "manual" });
    assert.equal(login.status, 303);
    assert.equal(new URL(login.headers.get("location")!).pathname, "/");
    const setCookie = login.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /operationos_control_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(";")[0]!;
    const issued = cookie.split("=")[1];
    assert.ok(issued, "Login response must issue a nonempty session cookie");
    authorizeFounderSession({ token: issued, config: { founderId, sessionSecret: secret }, now: new Date() });
    const proof = await fetch(`${base}/api/control-plane/proof`, { method: "POST", headers: { ...headers, cookie } });
    assert.equal(proof.status, 503);
    assert.deepEqual(await proof.json(), { error: "Controlled proof unavailable" });
    const publicHost = await fetch(`${base}/api/control-plane/proof`, { method: "POST",
      headers: { ...headers, host: "operationos.org", "x-forwarded-host": "operationos.org", cookie } });
    assert.equal(publicHost.status, 404);
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => identity.close(() => resolve()));
  }
});
