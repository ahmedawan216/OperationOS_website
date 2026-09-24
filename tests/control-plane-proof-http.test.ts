import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createFounderSessionToken } from "../lib/control-plane/auth-core";

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
