import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const CONTROL_PLANE_COOKIE = "operationos_control_session";

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
