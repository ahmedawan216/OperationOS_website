import { NextResponse } from "next/server";
import { clearFounderSession, requireFounderSession } from "@/lib/control-plane/auth";
import { assertTrustedControlPlaneOrigin } from "@/lib/control-plane/auth-core";

export async function POST(request: Request) {
  await requireFounderSession();
  assertTrustedControlPlaneOrigin({ requestUrl: request.url, origin: request.headers.get("origin"), configuredOrigin: process.env.CONTROL_PLANE_ORIGIN });
  await clearFounderSession();
  return NextResponse.redirect(new URL("/control/login", request.url), 303);
}
