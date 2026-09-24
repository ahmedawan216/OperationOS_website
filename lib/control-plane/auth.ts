import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  authenticateFounderAndCreateSession,
  authorizeFounderSession,
  CONTROL_PLANE_COOKIE,
  founderSessionCookieOptions,
  type FounderAuthConfig,
  type FounderIdentityVerifier,
  type FounderSession,
} from "./auth-core";
import { createSupabaseFounderIdentityVerifier } from "./founder-auth-provider";

function authConfig(): FounderAuthConfig {
  const founderId = process.env.CONTROL_PLANE_FOUNDER_ID?.trim();
  const sessionSecret = process.env.CONTROL_PLANE_SESSION_SECRET;
  if (!founderId || !sessionSecret || sessionSecret.length < 32) {
    throw new Error("Control Plane founder session configuration is invalid");
  }
  return { founderId, sessionSecret };
}

export async function readFounderSession(): Promise<FounderSession | null> {
  const token = (await cookies()).get(CONTROL_PLANE_COOKIE)?.value;
  try {
    return authorizeFounderSession({ token, config: authConfig(), now: new Date() });
  } catch {
    return null;
  }
}

export async function requireFounderSession(): Promise<FounderSession> {
  const session = await readFounderSession();
  if (!session) notFound();
  return session;
}

export async function issueFounderSession(input: {
  password: string;
  now?: Date;
  verifier?: FounderIdentityVerifier;
}): Promise<FounderSession> {
  const now = input.now ?? new Date();
  const result = await authenticateFounderAndCreateSession({
    password: input.password,
    verifier: input.verifier ?? createSupabaseFounderIdentityVerifier(),
    config: authConfig(),
    now,
    nonce: randomBytes(24).toString("base64url"),
  });
  (await cookies()).set(CONTROL_PLANE_COOKIE, result.token, founderSessionCookieOptions(process.env.NODE_ENV === "production"));
  return authorizeFounderSession({ token: result.token, config: authConfig(), now });
}

export async function clearFounderSession(): Promise<void> {
  (await cookies()).set(CONTROL_PLANE_COOKIE, "", {
    ...founderSessionCookieOptions(process.env.NODE_ENV === "production"),
    maxAge: 0,
  });
}
