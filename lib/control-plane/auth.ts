import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { authorizeFounderSession, CONTROL_PLANE_COOKIE, type FounderSession } from "./auth-core";

function authConfig() {
  return {
    founderId: process.env.CONTROL_PLANE_FOUNDER_ID,
    sessionSecret: process.env.CONTROL_PLANE_SESSION_SECRET,
  };
}

export async function requireFounderSession(): Promise<FounderSession> {
  const token = (await cookies()).get(CONTROL_PLANE_COOKIE)?.value;
  try {
    return authorizeFounderSession({ token, config: authConfig(), now: new Date() });
  } catch {
    notFound();
  }
}
