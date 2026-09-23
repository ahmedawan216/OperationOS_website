import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const CONTROL_PLANE_COOKIE = "operationos_control_session";
export const CONTROL_PLANE_SESSION_TTL_SECONDS = 8 * 60 * 60;

const sessionSchema = z.object({
  sub: z.string().trim().min(1).max(200),
  role: z.literal("founder"),
  exp: z.number().int().positive(),
  nonce: z.string().min(16).max(200),
}).strict();

export type FounderSession = z.infer<typeof sessionSchema>;

export interface FounderAuthConfig {
  founderId: string;
  sessionSecret: string;
}

export interface FounderIdentityVerifier {
  verifyPassword(password: string): Promise<boolean>;
}

export class ControlPlaneAuthorizationError extends Error {
  readonly code = "CONTROL_PLANE_UNAUTHORIZED";
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createFounderSessionToken(session: FounderSession, config: FounderAuthConfig): string {
  const parsed = sessionSchema.parse(session);
  if (parsed.sub !== config.founderId || config.sessionSecret.length < 32) {
    throw new ControlPlaneAuthorizationError("Founder session configuration is invalid");
  }
  const payload = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");
  return `${payload}.${signature(payload, config.sessionSecret)}`;
}

export function authorizeFounderSession(input: {
  token?: string;
  config?: Partial<FounderAuthConfig>;
  now: Date;
}): FounderSession {
  const founderId = input.config?.founderId?.trim();
  const secret = input.config?.sessionSecret;
  if (!founderId || !secret || secret.length < 32 || !input.token) {
    throw new ControlPlaneAuthorizationError("Control Plane access is not authorized");
  }
  const [payload, supplied, extra] = input.token.split(".");
  if (!payload || !supplied || extra) throw new ControlPlaneAuthorizationError("Invalid founder session");
  const expected = signature(payload, secret);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw new ControlPlaneAuthorizationError("Invalid founder session");
  }
  let session: FounderSession;
  try {
    session = sessionSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    throw new ControlPlaneAuthorizationError("Invalid founder session");
  }
  if (session.sub !== founderId || session.exp <= Math.floor(input.now.getTime() / 1000)) {
    throw new ControlPlaneAuthorizationError("Founder session is expired or mismatched");
  }
  return Object.freeze(structuredClone(session));
}

export async function authenticateFounderAndCreateSession(input: {
  password: string;
  verifier: FounderIdentityVerifier;
  config: FounderAuthConfig;
  now: Date;
  nonce: string;
}): Promise<{ token: string; expiresAt: Date }> {
  if (input.password.length < 8 || input.password.length > 1_024) {
    throw new ControlPlaneAuthorizationError("Founder credentials are invalid");
  }
  let verified = false;
  try {
    verified = await input.verifier.verifyPassword(input.password);
  } catch {
    throw new ControlPlaneAuthorizationError("Founder authentication is unavailable");
  }
  if (!verified) throw new ControlPlaneAuthorizationError("Founder credentials are invalid");
  const expiresAt = new Date(input.now.getTime() + CONTROL_PLANE_SESSION_TTL_SECONDS * 1_000);
  return {
    token: createFounderSessionToken({
      sub: input.config.founderId,
      role: "founder",
      exp: Math.floor(expiresAt.getTime() / 1_000),
      nonce: input.nonce,
    }, input.config),
    expiresAt,
  };
}

export function founderSessionCookieOptions(production: boolean) {
  return Object.freeze({
    httpOnly: true,
    secure: production,
    sameSite: "strict" as const,
    path: "/",
    maxAge: CONTROL_PLANE_SESSION_TTL_SECONDS,
    priority: "high" as const,
  });
}

export function assertTrustedControlPlaneOrigin(input: {
  requestUrl: string;
  origin: string | null;
  configuredOrigin?: string;
}): void {
  const expected = input.configuredOrigin?.trim() || new URL(input.requestUrl).origin;
  if (!input.origin || input.origin !== expected) {
    throw new ControlPlaneAuthorizationError("Untrusted Control Plane request origin");
  }
}
