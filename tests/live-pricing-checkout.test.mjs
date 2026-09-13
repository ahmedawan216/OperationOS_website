import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pricing = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
const config = readFileSync(new URL("../lib/site-config.ts", import.meta.url), "utf8");
const analytics = readFileSync(new URL("../lib/analytics.ts", import.meta.url), "utf8");

test("pricing CTAs point to the production RecruitOS commercial paths", () => {
  assert.ok(config.includes('appUrl: "https://recruitos.operationos.org"'));
  assert.ok(pricing.includes('href: recruitosConfig.signUpUrl'));
  assert.ok(pricing.includes('getRecruitOSCheckoutUrl("standard")'));
  assert.ok(pricing.includes('getRecruitOSCheckoutUrl("pro")'));
});

test("OperationOS pricing never embeds Paddle price IDs", () => {
  assert.equal(/pri_[a-zA-Z0-9]/.test(pricing + config), false);
});

test("obsolete checkout-not-live copy is removed", () => {
  assert.equal(pricing.includes("Paid checkout is not live yet"), false);
  assert.equal(pricing.includes("This starts with account creation"), false);
});

test("existing pricing analytics retain the event and distinguish selected plans", () => {
  assert.ok(pricing.includes('eventName="recruitos_access_clicked"'));
  assert.ok(pricing.includes("plan: plan.planKey"));
  assert.ok(pricing.includes('plan: "free"'));
  assert.ok(analytics.includes('destination: "sign_up" | "sign_in" | "checkout"'));
  assert.ok(analytics.includes('plan?: "free" | "standard" | "pro"'));
});

test("paid pricing cards keep a concise trust cue without changing billing authority", () => {
  assert.ok(pricing.includes("Secure monthly billing. Cancel anytime."));
  assert.equal(pricing.includes("—"), false);
});

test("OperationOS pricing contains no Paddle credentials or provider secrets", () => {
  const sensitivePattern = /PADDLE_(?:API_KEY|WEBHOOK_SECRET|CLIENT_TOKEN)|NEXT_PUBLIC_PADDLE|ctm_|sub_/;
  assert.equal(sensitivePattern.test(pricing + config), false);
});

test("pricing page keeps the existing three-card visual structure", () => {
  assert.ok(pricing.includes('grid gap-6 lg:grid-cols-3 lg:items-stretch'));
  assert.ok(pricing.includes('plans.map((plan) =>'));
  assert.ok(pricing.includes('plan.emphasized'));
});
