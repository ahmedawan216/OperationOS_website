import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { fixtureSnapshot } from "../lib/control-plane/testing/fixture-provider.ts";

const sections = [
  ["overview", "Command Center"], ["products", "Products"], ["agents", "Agents"],
  ["executions", "Executions"], ["learnings", "Learnings"], ["improvements", "Improvements"],
  ["evaluations", "Evaluations"], ["safety", "Safety"], ["approvals", "Approvals"],
  ["versions", "Versions &amp; Canaries"], ["health", "System Health"],
];

test("every Control Panel section renders authoritative records and truthful empty states", () => {
  const source = `
    import assert from "node:assert/strict";
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import * as controlPlaneViewModule from "./components/control-plane/control-plane-view.tsx";
    globalThis.React = React;
    const ControlPlaneView = controlPlaneViewModule.ControlPlaneView ?? controlPlaneViewModule.default?.ControlPlaneView;
    assert.equal(typeof ControlPlaneView, "function", "ControlPlaneView must remain an exported component");
    const snapshot = JSON.parse(process.env.CONTROL_PANEL_TEST_SNAPSHOT);
    const sections = JSON.parse(process.env.CONTROL_PANEL_TEST_SECTIONS);
    for (const [section, heading] of sections) {
      const populated = renderToStaticMarkup(ControlPlaneView({ snapshot, section }));
      assert.match(populated, new RegExp(heading));
    }
    const empty = { ...snapshot, products: [], agents: [], executions: [], learnings: [], improvements: [], evaluations: [], safety: [], approvals: [], versions: [], canaries: [], recentEvents: [], health: { ...snapshot.health, state: "healthy", successRate: null, verificationFailures: 0, retries: 0, replans: 0, providerFailures: 0, openSafetyFindings: 0 } };
    const expected = {
      overview: ["No verified runs yet", "No decisions awaiting review", "No important events yet"],
      products: ["No products registered"], agents: ["No agents registered"], executions: ["No executions yet"],
      learnings: ["No learnings yet"], improvements: ["No improvement candidates"], evaluations: ["No evaluations yet"],
      safety: ["No safety findings"], approvals: ["No approval requests"], versions: ["No versions registered", "No canaries running"],
      health: ["No verified runs yet"],
    };
    for (const [section, copy] of Object.entries(expected)) {
      const rendered = renderToStaticMarkup(ControlPlaneView({ snapshot: empty, section }));
      for (const phrase of copy) assert.match(rendered, new RegExp(phrase));
      assert.doesNotMatch(rendered, /0% verified success/);
    }
    process.stdout.write("render-audit-ok");
  `;
  const result = execFileSync(process.execPath, ["--import", "tsx", "--eval", source], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      CONTROL_PANEL_TEST_SNAPSHOT: JSON.stringify(fixtureSnapshot),
      CONTROL_PANEL_TEST_SECTIONS: JSON.stringify(sections),
    },
  });
  assert.equal(result, "render-audit-ok");
});

test("private shell exposes every destination with clean-host routing and canonical branding", () => {
  const shell = readFileSync(new URL("../components/control-plane/control-plane-shell.tsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("../app/control/login/page.tsx", import.meta.url), "utf8");
  const publicLayout = readFileSync(new URL("../app/(public)/layout.tsx", import.meta.url), "utf8");
  const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  for (const label of ["Command", "Products", "Agents", "Executions", "Learnings", "Improvements", "Evaluations", "Safety", "Approvals", "Versions", "Health", "Meta-Agent"]) {
    assert.match(shell, new RegExp(`\\["${label}"`));
  }
  assert.match(shell, /aria-current/);
  assert.match(shell, /Control Panel navigation/);
  assert.match(shell, /operationos-h1-mark-white\.svg/);
  assert.match(login, /operationos-h1-horizontal-white\.svg/);
  assert.match(login, /OperationOS Control Panel/);
  assert.doesNotMatch(login, /OperationOS Control Plane/);
  assert.match(publicLayout, /<Header \/>/);
  assert.match(publicLayout, /<Footer \/>/);
  assert.doesNotMatch(rootLayout, /<Header \/>|<Footer \/>/);
});

test("founder-facing source copy uses Control Panel while technical identifiers remain stable", () => {
  const visible = [
    "../app/control/login/page.tsx",
    "../components/control-plane/control-plane-shell.tsx",
    "../components/control-plane/control-plane-view.tsx",
    "../app/control/layout.tsx",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(visible, />[^<]*Control Plane[^<]*</);
  assert.match(readFileSync(new URL("../lib/control-plane/provider.ts", import.meta.url), "utf8"), /Control Plane provider mode mismatch/);
});
